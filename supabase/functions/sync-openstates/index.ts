// State coverage: recent legislature activity for every state we serve.
//
// Before this, State stories existed for exactly one state, so anyone outside
// Maryland saw nothing at that tier. OpenStates covers all 50 legislatures and
// returns a complete record in the list call — title, identifier, latest
// action, sponsors and a source URL — so one request per state is enough.
//
// The model rewrites those fields into plain language and nothing else. Bill
// status is copied from the record, never generated.
//
// Deploy:  supabase functions deploy sync-openstates
// Secrets: OPENSTATES_API_KEY, ANTHROPIC_API_KEY
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENSTATES_API_KEY = Deno.env.get("OPENSTATES_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PER_STATE = 6;
const BATCH = 6;
const PACE_MS = 1200; // OpenStates asks for gentle pacing on the free tier
// Edge Functions have a 150s wall clock. Twenty states in one invocation blew
// straight through it, so each run takes a bounded slice and the schedule
// cycles through the rest.
const STATES_PER_RUN = 5;

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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface OsBill {
  id: string;
  identifier: string;
  title: string;
  subject: string[];
  updated_at: string;
  latest_action_date: string | null;
  latest_action_description: string | null;
  openstates_url: string;
  sponsorships?: { name: string }[];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/**
 * A usable ISO timestamp, or now. One bill with a malformed date used to throw
 * RangeError out of the whole run, losing every state after it.
 */
function safeIso(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c.length === 10 ? `${c}T12:00:00Z` : c);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

/** Concatenates every text block; indexing content[0] fails silently. */
function textFrom(data: any): string {
  return (data?.content ?? [])
    .filter((c: any) => c?.type === "text" && typeof c.text === "string")
    .map((c: any) => c.text)
    .join("");
}

const SYSTEM = `You write short, neutral summaries of US STATE legislation for a civics app.

For each bill you receive the state, bill number, official title, sponsors and latest recorded action. Those are your ONLY facts.

Return a JSON array, one object per input, same order, each with:
  "whatHappened" — 1-2 sentences on what the bill concerns and where it stands, from the fields given
  "whyItMatters" — 1-2 sentences on who in that state is affected and how, in general terms

Rules you must not break:
- Never state a fact not present in the fields. No amounts, vote counts, provisions or outcomes that aren't there.
- Read the latest action literally. "Referred to committee" is not passage. Only say it became law if the action says so.
- Never say whether the bill is good, bad or likely to pass, and never characterise a sponsor's party or motives.
- If the title is too vague to describe, say plainly that the bill text sets out the detail.
- Plain sentences. No markdown.

Return only the JSON array.`;

async function summarize(
  bills: { state: string; number: string; title: string; sponsors: string; latestAction: string }[]
): Promise<{ items: { whatHappened: string; whyItMatters: string }[]; why?: string }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(bills) }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) return { items: [], why: `anthropic ${res.status}` };
  const data = await res.json();
  const text = textFrom(data);
  const a = text.indexOf("["), b = text.lastIndexOf("]");
  if (a < 0 || b < 0) return { items: [], why: `no JSON array; stop=${data.stop_reason}` };
  try { return { items: JSON.parse(text.slice(a, b + 1)) }; } catch { return { items: [], why: "parse failed" }; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    if (!OPENSTATES_API_KEY || !ANTHROPIC_API_KEY) {
      return json({ error: "OPENSTATES_API_KEY and ANTHROPIC_API_KEY must be set." }, 500);
    }
    const body = await req.json().catch(() => ({}));

    // Every state, not only the ones we've already seen a user from.
    // zip_locations fills in as ZIPs get resolved, so scoping to it was
    // circular: a new user in a state we'd never served would find no state
    // coverage precisely because they were the first person there. Coverage
    // has to exist before the user arrives, not after.
    const served: string[] = Object.keys(STATE_NAMES);

    // Least-recently-attempted first. Ordering by newest bill date instead
    // kept re-picking out-of-session legislatures — Texas and Nevada always
    // look stalest because their latest bill genuinely is old — so states
    // that were up to date never got revisited.
    let states: string[] = body.states ?? [];
    if (states.length === 0) {
      const { data: log } = await supabase
        .from("state_sync_log").select("state_abbr, last_attempt_at");
      const lastAttempt = new Map((log ?? []).map((r) => [r.state_abbr, r.last_attempt_at as string]));
      states = served
        .sort((a, b) => (lastAttempt.get(a) ?? "").localeCompare(lastAttempt.get(b) ?? ""))
        .slice(0, Number(body.limit) || STATES_PER_RUN);
    }

    let inserted = 0, failed = 0;
    const upstream: Record<string, unknown> = {};

    for (const abbr of states) {
      await supabase.from("state_sync_log").upsert({
        state_abbr: abbr,
        last_attempt_at: new Date().toISOString(),
      });

      const url =
        `https://v3.openstates.org/bills?jurisdiction=ocd-jurisdiction/country:us/state:` +
        `${abbr.toLowerCase()}/government&sort=updated_desc&per_page=${PER_STATE}&include=sponsorships`;

      try {
      const res = await fetch(url, {
        headers: { "X-API-KEY": OPENSTATES_API_KEY },
        signal: AbortSignal.timeout(30000),
      });

      // Surfaced, never swallowed: a throttled key must not read as a quiet
      // legislature.
      if (!res.ok) {
        upstream[abbr] = { status: res.status, error: (await res.text()).slice(0, 140) };
        continue;
      }

      const bills: OsBill[] = ((await res.json()).results ?? []).filter((b: OsBill) => b?.title);
      upstream[abbr] = { status: 200, returned: bills.length };

      const ids = bills.map((b) => `openstates-${b.id}`);
      const { data: existing } = await supabase.from("stories").select("external_id").in("external_id", ids);
      const have = new Set((existing ?? []).map((r) => r.external_id));
      const todo = bills.filter((b) => !have.has(`openstates-${b.id}`));
      if (todo.length === 0) { await new Promise((r) => setTimeout(r, PACE_MS)); continue; }

      for (let i = 0; i < todo.length; i += BATCH) {
        const slice = todo.slice(i, i + BATCH);
        const { items: summaries } = await summarize(
          slice.map((b) => ({
            state: STATE_NAMES[abbr] ?? abbr,
            number: b.identifier,
            title: b.title,
            sponsors: (b.sponsorships ?? []).slice(0, 4).map((s) => s.name).join(", ") || "Not listed",
            latestAction: b.latest_action_description ?? "No action recorded",
          }))
        );

        for (let j = 0; j < slice.length; j++) {
          const b = slice[j];
          const sum = summaries[j];
          if (!sum?.whatHappened) { failed++; continue; }

          const when = safeIso(b.latest_action_date, b.updated_at);

          const { data: story, error } = await supabase
            .from("stories")
            .insert({
              external_id: `openstates-${b.id}`,
              source_system: "openstates",
              topic: b.subject?.[0] ?? "State legislature",
              scope: "State",
              state: STATE_NAMES[abbr] ?? null,
              headline: `${b.identifier} — ${b.title}`.slice(0, 200),
              what_happened: sum.whatHappened,
              why_it_matters: sum.whyItMatters,
              // Copied from the record, never generated.
              status: b.latest_action_description ?? "No action recorded",
              sponsor: (b.sponsorships ?? [])[0]?.name ?? "Not listed",
              cosponsors: `${Math.max(0, (b.sponsorships ?? []).length - 1)} cosponsors`,
              next_checkpoint: "Not yet determined — check latest action",
              fiscal_note: "Not yet scored",
              what_is_uncertain:
                "Summarised from the bill's title and latest recorded action; the bill text sets out the detail.",
              published_at: when,
              updated_at: when,
            })
            .select("id")
            .single();
          if (error || !story) { failed++; continue; }

          await supabase.from("sources").insert({
            story_id: story.id,
            label: `${b.identifier} · ${STATE_NAMES[abbr] ?? abbr} Legislature`,
            type: "Primary source",
            domain: "openstates.org",
            url: b.openstates_url,
          });
          inserted++;
        }
      }
      } catch (e) {
        upstream[abbr] = { status: "exception", error: String(e).slice(0, 140) };
      }
      await supabase.from("state_sync_log")
        .update({ last_result: JSON.stringify(upstream[abbr] ?? null).slice(0, 200) })
        .eq("state_abbr", abbr);
      await new Promise((r) => setTimeout(r, PACE_MS));
    }

    return json({ ok: true, served: served.length, processed: states, inserted, failed, upstream });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
