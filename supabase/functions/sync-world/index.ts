// World coverage.
//
// The World tier had ten stories, all hand-seeded on one day in August, with
// no source_system and no ingest behind them. It has been frozen ever since.
//
// Source is Wikipedia's Current Events Portal, which is a genuinely good fit
// here and not an obvious one. It is edited daily, grouped by theme, written
// in flat declarative sentences, and — the part that matters for this app —
// nearly every entry carries an inline citation to the outlet that reported
// it. So each story we create can link out to a real source rather than to us.
//
// Wikipedia is not the authority for any of these events; the cited outlet is.
// That's why the citation URL becomes the story's source and the portal itself
// is never presented as the origin.
//
// Deploy:  supabase functions deploy sync-world
// Secrets: ANTHROPIC_API_KEY
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAYS_BACK = 4;
const MAX_PER_RUN = 10;
const BATCH = 5;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Event {
  /** Stable across runs: the portal page plus the citation or the text itself. */
  key: string;
  date: string;
  section: string;
  text: string;
  sourceUrl: string | null;
  sourceName: string | null;
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

/** Wikitext -> readable prose. [[A|B]] keeps B, [[A]] keeps A. */
function stripMarkup(s: string): string {
  return s
    .replace(/\[https?:\/\/[^\s\]]+\s*\(?''([^'']+)''\)?\]/g, "")
    .replace(/\[https?:\/\/[^\s\]]+[^\]]*\]/g, "")
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** djb2 — a short stable id for entries with no citation URL. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function parseDay(wikitext: string, date: string): Event[] {
  const out: Event[] = [];
  let section = "World";

  for (const raw of wikitext.split("\n")) {
    const line = raw.trim();

    // "'''International relations'''" heads each group.
    const head = line.match(/^'''(.+?)'''$/);
    if (head) {
      section = stripMarkup(head[1]);
      continue;
    }

    // Events are the nested bullets; the single-star lines are topic links.
    if (!line.startsWith("**")) continue;
    const body = line.replace(/^\*+/, "").trim();

    const cite = body.match(/\[(https?:\/\/[^\s\]]+)[^\]]*?''([^'']+)''[^\]]*\]/);
    const bare = body.match(/\[(https?:\/\/[^\s\]]+)/);
    const sourceUrl = cite?.[1] ?? bare?.[1] ?? null;
    const sourceName = cite?.[2]?.trim() ?? null;

    const text = stripMarkup(body);
    // Very short fragments are almost always list scaffolding, not events.
    if (text.length < 40) continue;
    // No citation, no story. A few entries are running headers for an ongoing
    // situation rather than a reported event, and this app's whole claim is
    // that everything links back to where it came from.
    if (!sourceUrl) continue;

    out.push({
      key: `wikicurrent-${date}-${hash(sourceUrl ?? text)}`,
      date,
      section,
      text,
      sourceUrl,
      sourceName,
    });
  }
  return out;
}

const SYSTEM = `You write short, neutral summaries of international news for a US civics app.

For each item you receive the date, the theme it was filed under, and a factual one-paragraph account of the event. That account is your ONLY source of facts.

Return a JSON array, one object per input, same order, each with:
  "headline" — under 90 characters, plain language, no clickbait, no question marks
  "whatHappened" — 1-2 sentences restating the event plainly
  "whyItMatters" — 1-2 sentences on why it's relevant to a US reader, in general terms

Rules you must not break:
- Never state a fact not present in the account. No casualty figures, dates, names or outcomes that aren't there.
- Never speculate about what happens next, and never say a thing is likely or unlikely.
- Never take a side, assign blame, or characterise any government's motives.
- For "whyItMatters", connect to US interests only where the account supports it — trade, alliances, security, energy, migration. If there is no clear connection, say plainly that it's context for understanding a region rather than a direct US matter.
- Neutral register. These are often violent events; do not dramatise them.
- Plain sentences. No markdown.

Return only the JSON array.`;

async function summarize(
  items: { date: string; theme: string; account: string }[]
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

function domainOf(url: string | null): string {
  if (!url) return "en.wikipedia.org";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "en.wikipedia.org";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY is not set." }, 500);
    const body = await req.json().catch(() => ({}));
    const daysBack = Math.min(Number(body.days) || DAYS_BACK, 7);

    const collected: Event[] = [];
    const pages: Record<string, unknown> = {};

    for (let d = 0; d < daysBack; d++) {
      const day = new Date();
      day.setUTCDate(day.getUTCDate() - d);
      const iso = day.toISOString().slice(0, 10);
      const title = `Portal:Current_events/${day.getUTCFullYear()}_${MONTHS[day.getUTCMonth()]}_${day.getUTCDate()}`;

      const res = await fetch(
        `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2`,
        {
          headers: { "User-Agent": "PolitickBot/1.0 (+https://politickapp.com; civic app ingest)" },
          signal: AbortSignal.timeout(20000),
        }
      );
      if (!res.ok) { pages[iso] = { status: res.status }; continue; }

      const data = await res.json();
      if (data?.error) { pages[iso] = { error: data.error.code }; continue; }

      const events = parseDay(data?.parse?.wikitext ?? "", iso);
      pages[iso] = { events: events.length };
      collected.push(...events);
    }

    const ids = collected.map((e) => e.key);
    const { data: existing } = await supabase
      .from("stories").select("external_id").in("external_id", ids);
    const have = new Set((existing ?? []).map((r) => r.external_id));
    const todo = collected.filter((e) => !have.has(e.key)).slice(0, MAX_PER_RUN);

    let inserted = 0, failed = 0, sourceFailed = 0;

    for (let i = 0; i < todo.length; i += BATCH) {
      const slice = todo.slice(i, i + BATCH);
      const summaries = await summarize(
        slice.map((e) => ({ date: e.date, theme: e.section, account: e.text }))
      );

      for (let j = 0; j < slice.length; j++) {
        const e = slice[j];
        const sum = summaries[j];
        if (!sum?.headline || !sum?.whatHappened) { failed++; continue; }

        const when = new Date(`${e.date}T12:00:00Z`).toISOString();

        const { data: story, error } = await supabase
          .from("stories")
          .insert({
            external_id: e.key,
            source_system: "wikipedia-current-events",
            topic: e.section,
            scope: "World",
            state: null,
            headline: sum.headline.slice(0, 200),
            what_happened: sum.whatHappened,
            why_it_matters: sum.whyItMatters,
            status: "Reported",
            sponsor: "Not applicable",
            cosponsors: "Not applicable",
            next_checkpoint: "Not yet determined",
            fiscal_note: "Not applicable",
            what_is_uncertain:
              "Summarised from a daily news digest. The linked outlet is the authority for the underlying reporting.",
            published_at: when,
            updated_at: when,
          })
          .select("id")
          .single();
        if (error || !story) { failed++; continue; }

        // The cited outlet is the source, not Wikipedia. Entries without a
        // citation never reach here. Where the outlet's name isn't in the
        // markup the domain stands in — labelling a CNN link "Wikipedia"
        // would misattribute the reporting.
        // "Reporting" is one of the five values source_type allows. An
        // invented label ("News report") threw, and because this insert's
        // error was never checked the stories landed with no source at all —
        // the one thing this tier is not allowed to do.
        const { error: srcError } = await supabase.from("sources").insert({
          story_id: story.id,
          label: `${e.sourceName ?? domainOf(e.sourceUrl)} — original reporting`,
          type: "Reporting",
          domain: domainOf(e.sourceUrl),
          url: e.sourceUrl!,
        });
        if (srcError) {
          // A world story without its citation is worse than no story, so the
          // story goes back out rather than standing unsourced.
          await supabase.from("stories").delete().eq("id", story.id);
          sourceFailed++;
          continue;
        }
        inserted++;
      }
    }

    return json({ ok: true, scanned: collected.length, inserted, failed, sourceFailed, pages });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
