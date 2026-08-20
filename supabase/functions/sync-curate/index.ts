// Local coverage: turns Curate's local-government documents into Politick
// stories for the towns we actually serve.
//
// Curate scans agendas and minutes from ~12,000 cities, counties and school
// districts. This pulls the topics a resident would care about, keeps only
// documents from a city we have a ZIP for, and writes one story per document.
//
// The model is used to rewrite the matched excerpt into plain language and
// nothing else — it is told the excerpt is the only source of fact. Every
// story keeps the original document URL, so the claim is always checkable.
//
// Two API quirks that are easy to get wrong:
//   - topic_ids must be REPEATED params; a comma-separated list returns 500.
//   - one state per request; states_list=MD,CA returns 500.
//
// Deploy:  supabase functions deploy sync-curate
// Secrets: POLICYNOTE_API_KEY, ANTHROPIC_API_KEY
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const POLICYNOTE_API_KEY = Deno.env.get("POLICYNOTE_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Curate topics that map to what a resident would actually notice locally. */
const TOPIC_IDS = [
  "1",   // Affordable Housing
  "0",   // Accessory Dwellings
  "53",  // Rental Housing
  "80",  // Homelessness
  "74",  // Zoning & Land Use Code
  "5",   // Budgeting
  "65",  // Local Taxes
  "192", // Public Transit
  "261", // Policing
  "30",  // Government Accountability
  "104", // Referendums
  "7",   // Campaigns & Elections
  "266", // Educational & After-School Programs
  "255", // Wildfire Risk
  "41",  // Moratoriums
];

const TOPIC_NAMES: Record<string, string> = {
  "1": "Affordable Housing", "0": "Accessory Dwellings", "53": "Rental Housing",
  "80": "Homelessness", "74": "Zoning and Land Use", "5": "Local Budget",
  "65": "Local Taxes", "192": "Public Transit", "261": "Policing",
  "30": "Government Accountability", "104": "Referendums", "7": "Elections",
  "266": "Schools", "255": "Wildfire Risk", "41": "Moratoriums",
};

const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",
  CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",FL:"Florida",GA:"Georgia",
  HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",
  LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",
  MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",
  NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",
  OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",
  SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",
  VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",PR:"Puerto Rico",
};

const WINDOW_DAYS = 13;   // API caps the window at two weeks
const MAX_PER_STATE = 40;
const BATCH = 6;          // snippets per model call

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Snippet {
  location: string;
  state: string;
  locationType: string;
  url: string;
  documentType: string;
  documentId: string;
  postTs: number;
  topics: { text: string; topicIds: string[] }[];
}

/**
 * Concatenates every text block in a Claude response.
 *
 * Indexing content[0] blindly returns an empty string whenever the response
 * leads with a non-text block, which fails silently — stop_reason reads
 * end_turn and the caller sees no output with no error.
 */
function textFrom(data: any): string {
  return (data?.content ?? [])
    .filter((c: any) => c?.type === "text" && typeof c.text === "string")
    .map((c: any) => c.text)
    .join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function policynoteToken(): Promise<string> {
  const res = await fetch("https://data.policynote.com/v1/auth/token", {
    method: "POST",
    headers: { "x-api-key": POLICYNOTE_API_KEY! },
  });
  if (!res.ok) throw new Error(`PolicyNote auth failed: ${res.status}`);
  return (await res.json()).access_token;
}

async function fetchState(token: string, state: string, start: string, end: string): Promise<{ snippets: Snippet[]; status: number; error?: string }> {
  const params = new URLSearchParams({ states_list: state, start_date: start, end_date: end });
  // Repeated, not comma-joined — the API rejects a list.
  for (const t of TOPIC_IDS) params.append("topic_ids", t);

  const res = await fetch(`https://data.policynote.com/v1/curate/snippets?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(45000),
  });
  // A failed upstream must not look like "no local news". The status is
  // returned so a zero-result run can be told apart from a broken one.
  if (!res.ok) {
    return { snippets: [], status: res.status, error: (await res.text()).slice(0, 200) };
  }
  return { snippets: ((await res.json()).snippets ?? []).slice(0, MAX_PER_STATE), status: 200 };
}

const SYSTEM = `You turn excerpts from US local government meeting documents into short, neutral news items for a civics app.

For each document you receive the city, state, document type, date, and the exact excerpt that matched a policy topic. The excerpt is your ONLY source of fact.

Return a JSON array. One object per input, same order, each with:
  "headline"      — under 80 characters, plain language, names the place and the subject
  "whatHappened"  — 1-2 sentences restating only what the excerpt says
  "whyItMatters"  — 1 sentence on why a resident of that place would care, in general terms

Rules you must not break:
- Never state a fact the excerpt does not contain. No amounts, dates, vote counts, names or outcomes that aren't there.
- An agenda means something is scheduled for discussion, NOT that it was decided. Never imply an outcome.
- No opinion about whether it is good or bad, and no political characterisation.
- Agenda line items are normal and usable. "Bill 24-26, Buildings - Building Permits - Data Center Moratorium" is enough to write "Montgomery County Council is scheduled to consider a bill on data center building permits." Describe what is on the agenda; do not say what was decided.
- Only set "headline" to "" if the excerpt carries no identifiable subject at all.
- Plain sentences. No markdown.

Return only the JSON array.`;

async function summarize(items: Snippet[]): Promise<
  { headline: string; whatHappened: string; whyItMatters: string }[]
> {
  const payload = items.map((s) => ({
    city: s.location,
    state: s.state,
    documentType: s.documentType,
    date: new Date(s.postTs * 1000).toISOString().slice(0, 10),
    excerpt: (s.topics ?? []).map((t) => t.text).join(" … ").slice(0, 900),
  }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1600,
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) return [];

  const text = textFrom(await res.json());
  const start = text.indexOf("["), end = text.lastIndexOf("]");
  if (start < 0 || end < 0) return [];
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    if (!POLICYNOTE_API_KEY || !ANTHROPIC_API_KEY) {
      return json({ error: "POLICYNOTE_API_KEY and ANTHROPIC_API_KEY must be set." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const debug: unknown[] = [];
    const upstream: Record<string, unknown> = {};
    const end = new Date();
    const start = new Date(end.getTime() - WINDOW_DAYS * 86400000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    // Only places we can actually serve: a story about a town nobody's ZIP
    // maps to would never be shown to anyone.
    const { data: places } = await supabase
      .from("zip_locations").select("zip, city, county, state_abbr");

    // Curate reports a locality as a city/town OR a county, and most of the
    // decisions that reach residents are county-level. Matching cities alone
    // threw away every county document — including Montgomery County, which
    // is exactly where our Bethesda ZIPs are.
    const byCity = new Map<string, string[]>();
    const byCounty = new Map<string, string[]>();
    const norm = (v: string) =>
      v.toLowerCase().replace(/\b(county|parish|borough|city of|town of)\b/g, "").replace(/[^a-z ]/g, "").trim();

    for (const p of places ?? []) {
      const ck = `${norm(p.city as string)}|${p.state_abbr}`;
      byCity.set(ck, [...(byCity.get(ck) ?? []), p.zip as string]);
      if (p.county) {
        const nk = `${norm(p.county as string)}|${p.state_abbr}`;
        byCounty.set(nk, [...(byCounty.get(nk) ?? []), p.zip as string]);
      }
    }
    const zipsFor = (s: Snippet): string[] | undefined => {
      const key = `${norm(s.location ?? "")}|${s.state}`;
      return s.locationType === "county" ? byCounty.get(key) : byCity.get(key);
    };
    const states: string[] = body.states ?? [...new Set((places ?? []).map((p) => p.state_abbr as string))];

    const token = await policynoteToken();
    const report: Record<string, unknown> = { states, window: [fmt(start), fmt(end)] };
    let inserted = 0, skippedExisting = 0, skippedNoCity = 0, skippedThin = 0;

    for (const state of states) {
      const fetched = await fetchState(token, state, fmt(start), fmt(end));
      const snippets = fetched.snippets;
      upstream[state] = { status: fetched.status, returned: snippets.length, ...(fetched.error ? { error: fetched.error } : {}) };

      const relevant = snippets.filter((s) => {
        if (!zipsFor(s)) { skippedNoCity++; return false; }
        return true;
      });

      for (let i = 0; i < relevant.length; i += BATCH) {
        const batch = relevant.slice(i, i + BATCH);

        const ids = batch.map((s) => `curate-${s.documentId}`);
        const { data: existing } = await supabase
          .from("stories").select("external_id").in("external_id", ids);
        const have = new Set((existing ?? []).map((r) => r.external_id));
        const todo = batch.filter((s) => !have.has(`curate-${s.documentId}`));
        skippedExisting += batch.length - todo.length;
        if (todo.length === 0) continue;

        const summaries = await summarize(todo);
        if (body.debug) debug.push({ sent: todo.length, got: summaries.length, first: summaries[0] ?? null });

        for (let j = 0; j < todo.length; j++) {
          const s = todo[j];
          const sum = summaries[j];
          if (!sum?.headline) { skippedThin++; continue; }

          const topicId = (s.topics ?? [])[0]?.topicIds?.[0] ?? "";
          const when = new Date(s.postTs * 1000).toISOString();

          const { data: story, error } = await supabase
            .from("stories")
            .insert({
              external_id: `curate-${s.documentId}`,
              source_system: "curate",
              topic: TOPIC_NAMES[topicId] ?? "Local government",
              scope: "Local",
              state: STATE_NAMES[s.state] ?? null,
              headline: sum.headline.slice(0, 200),
              what_happened: sum.whatHappened,
              why_it_matters: sum.whyItMatters,
              // Local meeting records carry none of the legislative fields.
              status: "Not applicable — local government record",
              sponsor: "Not applicable — local government record",
              cosponsors: "Not applicable",
              next_checkpoint: "Not applicable",
              fiscal_note: "Not applicable",
              what_is_uncertain: "Summarised from the meeting document excerpt; see the source for full context.",
              published_at: when,
              updated_at: when,
            })
            .select("id")
            .single();
          if (error || !story) continue;

          await supabase.from("sources").insert({
            story_id: story.id,
            label: `${s.location} ${s.documentType}`,
            type: "Primary source",
            domain: (() => { try { return new URL(s.url).hostname.replace(/^www\./, ""); } catch { return "local government"; } })(),
            url: s.url,
          });

          const place = s.locationType === "county"
            ? `${s.location} County, ${s.state}`
            : `${s.location}, ${s.state}`;
          for (const zip of zipsFor(s) ?? []) {
            await supabase.from("story_zip_relevance").insert({
              story_id: story.id,
              zip,
              note: `This is your local government — ${place}.`,
            });
          }
          inserted++;
        }
      }
    }

    return json({ ok: true, inserted, skippedExisting, skippedNoCity, skippedThin, upstream, ...report,
      ...(body.debug ? { debug } : {}) });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
