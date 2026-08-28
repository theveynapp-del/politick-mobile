// Local coverage: city council legislation, from the councils themselves.
//
// The Local tier had five stories, all Montgomery County, three weeks stale,
// because it depended on PolicyNote/Curate and that account hit its quota.
// This replaces the dependency rather than waiting on it.
//
// Granicus Legistar runs the agenda and legislation system for a large share
// of US cities, and its Web API is public and unauthenticated. Each "matter"
// is a real council record: file number, full ordinance title, the body that
// handled it, and a status the city itself set.
//
// Client slugs are not derivable from the city name — Austin is
// "austintexas", Miami is "miamifl", LA County is "lacounty" — so each one is
// verified by hand. See the note on CITIES for what "verified" has to mean
// here: a 200 is not enough on its own.
//
// Deploy:  supabase functions deploy sync-local
// Secrets: ANTHROPIC_API_KEY
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PER_CITY = 10;
const BATCH = 5;
// 150s wall clock, and each city costs a list call plus a model call.
const CITIES_PER_RUN = 3;
const PACE_MS = 400;
// A client can stay online long after its council stops publishing to it.
// Anything older than this is treated as a dormant feed rather than news.
const MAX_AGE_DAYS = 120;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface City {
  slug: string;
  city: string;
  state: string;
}

/**
 * Which councils to read now lives in the legistar_clients table, not here.
 *
 * The list went 9 -> 24 -> 81 in a day, and every change meant redeploying a
 * function to edit an array. As a table, adding a city is an insert and
 * retiring a dark client is an update.
 *
 * What "verified" has to mean is worth recording even though the data moved:
 * item count and recency, never status code. minneapolismn answers 200 with
 * []; montgomerycountymd and miamidade answer 200 with records last touched
 * in 2023 and 2018. A dormant client is worse than a dead one, because it
 * publishes three-year-old proclamations as today's local news and nothing in
 * the response says so. MAX_AGE_DAYS enforces that at read time regardless of
 * what any row claims.
 *
 * Generic slugs are the other trap. "columbus", "kansascity", "wilmington",
 * "salem" and "alexandria" each name several US places, and a sweep will
 * happily file one under whichever city generated the slug. Each was checked
 * against its own records, which corrected two: columbus is Ohio (its matters
 * cite "Columbus, OH 43215"), not Georgia; kansascity is Missouri (Roy Blunt
 * Luminary Park), not Kansas. Filing a city under the wrong state shows the
 * wrong readers the wrong government.
 *
 * Still absent and not fixable with a better slug: Chicago and Philadelphia
 * (500), New York and DC (403). They expose no public Legistar API at all —
 * DC runs LIMS, NYC keeps its Legistar behind auth. Each is its own job.
 */
async function loadCities(): Promise<City[]> {
  const { data, error } = await supabase
    .from("legistar_clients")
    .select("slug, city, state")
    .eq("active", true);
  if (error) throw new Error(`legistar_clients unreadable: ${error.message}`);
  return (data ?? []) as City[];
}


interface Matter {
  MatterId: number;
  MatterGuid: string | null;
  MatterFile: string | null;
  MatterTitle: string | null;
  MatterTypeName: string | null;
  MatterStatusName: string | null;
  MatterBodyName: string | null;
  MatterIntroDate: string | null;
  MatterLastModifiedUtc: string | null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Concatenates every text block; indexing content[0] fails silently. */
function textFrom(data: any): string {
  return (data?.content ?? [])
    .filter((c: any) => c?.type === "text" && typeof c.text === "string")
    .map((c: any) => c.text)
    .join("");
}

function safeIso(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c.length === 10 ? `${c}T12:00:00Z` : c);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

const SYSTEM = `You write short, neutral summaries of CITY COUNCIL legislation for a civics app.

For each item you receive the city, state, file number, the official title, the type of measure, the council body, and the status the city recorded. Those are your ONLY facts.

Return a JSON array, one object per input, same order, each with:
  "headline" — under 90 characters, plain language, naming the city. No ALL CAPS.
  "whatHappened" — 1-2 sentences on what the measure does and where it stands, from the fields given
  "whyItMatters" — 1-2 sentences on who in that city is affected and how

Rules you must not break:
- Never state a fact not present in the fields. No amounts, addresses, vote counts or provisions that aren't there.
- Council titles are written in legal shorthand and often ALL CAPS. Rewrite into ordinary sentences; never copy the caps.
- Read the status literally. "Introduced" is not "Passed". Only say it was adopted if the status says so.
- Never say whether the measure is good, bad, or likely to pass, and never characterise anyone's motives.
- If the title is too vague to describe, say plainly that the full text sets out the detail.
- Plain sentences. No markdown.

Return only the JSON array.`;

async function summarize(
  items: {
    city: string;
    state: string;
    file: string;
    title: string;
    type: string;
    body: string;
    status: string;
  }[]
): Promise<{ headline: string; whatHappened: string; whyItMatters: string }[]> {
  if (!ANTHROPIC_API_KEY || items.length === 0) return [];
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 3000,
        system: SYSTEM,
        messages: [{ role: "user", content: JSON.stringify(items) }],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return [];
    const text = textFrom(await res.json());
    const a = text.indexOf("["), b = text.lastIndexOf("]");
    if (a < 0 || b < 0) return [];
    return JSON.parse(text.slice(a, b + 1));
  } catch {
    return [];
  }
}

function detailUrl(c: City, m: Matter): string {
  return m.MatterGuid
    ? `https://${c.slug}.legistar.com/LegislationDetail.aspx?ID=${m.MatterId}&GUID=${m.MatterGuid}`
    : `https://${c.slug}.legistar.com/Legislation.aspx`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY is not set." }, 500);
    const body = await req.json().catch(() => ({}));

    // Least-recently-attempted first, reusing the state log keyed by slug so a
    // run always advances rather than re-picking the same cities.
    const { data: log } = await supabase
      .from("state_sync_log")
      .select("state_abbr, last_attempt_at");
    const seen = new Map((log ?? []).map((r) => [r.state_abbr, r.last_attempt_at as string]));

    const CITIES = await loadCities();

    const requested: string[] = body.cities ?? [];
    const queue = (requested.length > 0
      ? CITIES.filter((c) => requested.includes(c.slug))
      : [...CITIES].sort((a, b) =>
          (seen.get(`legistar:${a.slug}`) ?? "").localeCompare(seen.get(`legistar:${b.slug}`) ?? "")
        )
    ).slice(0, Number(body.limit) || CITIES_PER_RUN);

    let inserted = 0, failed = 0;
    const upstream: Record<string, unknown> = {};

    for (const c of queue) {
      // Logged before the work starts, so a city that always fails still
      // rotates to the back of the queue rather than being retried forever.
      await supabase
        .from("state_sync_log")
        .upsert({ state_abbr: `legistar:${c.slug}`, last_attempt_at: new Date().toISOString() });

      try {
        // Labelled so every early exit still reaches the last_result write
        // below. Plain `continue`s here jumped clean over it, which is how a
        // failing city ended up logging an attempt and no reason for it —
        // the same bug this pipeline already hit once in sync-openstates.
        city: {
        const url =
          `https://webapi.legistar.com/v1/${c.slug}/matters` +
          `?$top=${PER_CITY}&$orderby=MatterLastModifiedUtc%20desc`;
        const res = await fetch(url, { signal: AbortSignal.timeout(25000) });

        // Surfaced, never swallowed: a dead client must not read as a quiet
        // council.
        if (!res.ok) {
          upstream[c.slug] = { status: res.status, error: (await res.text()).slice(0, 120) };
          break city;
        }

        const all = ((await res.json()) as Matter[]).filter((m) => m?.MatterTitle);
        const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
        const matters = all.filter(
          (m) => new Date(safeIso(m.MatterLastModifiedUtc, m.MatterIntroDate)).getTime() >= cutoff
        );
        upstream[c.slug] = { status: 200, returned: all.length, fresh: matters.length };
        if (matters.length === 0) break city;

        const ids = matters.map((m) => `legistar-${c.slug}-${m.MatterId}`);
        const { data: existing } = await supabase
          .from("stories").select("external_id").in("external_id", ids);
        const have = new Set((existing ?? []).map((r) => r.external_id));
        const todo = matters.filter((m) => !have.has(`legistar-${c.slug}-${m.MatterId}`));
        if (todo.length === 0) break city;

        for (let i = 0; i < todo.length; i += BATCH) {
          const slice = todo.slice(i, i + BATCH);
          const summaries = await summarize(
            slice.map((m) => ({
              city: c.city,
              state: c.state,
              file: m.MatterFile ?? "Not numbered",
              title: (m.MatterTitle ?? "").slice(0, 900),
              type: m.MatterTypeName ?? "Measure",
              body: m.MatterBodyName ?? "City council",
              status: m.MatterStatusName ?? "No status recorded",
            }))
          );

          for (let j = 0; j < slice.length; j++) {
            const m = slice[j];
            const sum = summaries[j];
            if (!sum?.whatHappened || !sum?.headline) { failed++; continue; }

            const when = safeIso(m.MatterLastModifiedUtc, m.MatterIntroDate);

            const { data: story, error } = await supabase
              .from("stories")
              .insert({
                external_id: `legistar-${c.slug}-${m.MatterId}`,
                source_system: "legistar",
                topic: m.MatterTypeName ?? "City council",
                scope: "Local",
                state: c.state,
                headline: sum.headline.slice(0, 200),
                what_happened: sum.whatHappened,
                why_it_matters: sum.whyItMatters,
                // Set by the city, never generated.
                status: m.MatterStatusName ?? "No status recorded",
                sponsor: m.MatterBodyName ?? "Not listed",
                cosponsors: "Not listed",
                next_checkpoint: "Not yet determined — check the council record",
                fiscal_note: "Not yet scored",
                what_is_uncertain:
                  "Summarised from the measure's official title and recorded status; the full text sets out the detail.",
                published_at: when,
                updated_at: when,
              })
              .select("id")
              .single();
            if (error || !story) { failed++; continue; }

            await supabase.from("sources").insert({
              story_id: story.id,
              label: `${m.MatterFile ?? "Council record"} · ${c.city} ${m.MatterBodyName ?? "City Council"}`,
              type: "Primary source",
              domain: `${c.slug}.legistar.com`,
              url: detailUrl(c, m),
            });
            inserted++;
          }
        }
        }
      } catch (e) {
        upstream[c.slug] = { status: "exception", error: String(e).slice(0, 120) };
      }

      await supabase
        .from("state_sync_log")
        .update({ last_result: JSON.stringify(upstream[c.slug] ?? null).slice(0, 200) })
        .eq("state_abbr", `legistar:${c.slug}`);
      await new Promise((r) => setTimeout(r, PACE_MS));
    }

    return json({
      ok: true,
      configured: CITIES.length,
      processed: queue.map((c) => c.slug),
      inserted,
      failed,
      upstream,
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
