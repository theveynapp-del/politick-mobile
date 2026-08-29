// Federal coverage: recent congressional activity as Rotunda stories.
//
// Ports scripts/sync-congress.ts to an Edge Function so it can run on a
// schedule instead of only when someone types npm run sync:congress. Two
// substantive changes from the script:
//
//   - dedupe is on a stable external_id rather than the headline, so a bill
//     that changes title doesn't get ingested twice
//   - why_it_matters is written rather than stamped NEEDS_EDITORIAL_REVIEW,
//     which is why older federal stories read "(editorial analysis not yet
//     completed for this story)" in the app
//
// The model sees only the bill's official title, sponsor, policy area and
// latest action, and is told those are its only facts. Bill status is never
// generated — it is read from the record.
//
// Deploy:  supabase functions deploy sync-congress
// Secrets: DATA_GOV_API_KEY, ANTHROPIC_API_KEY
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RAW_KEY = Deno.env.get("DATA_GOV_API_KEY");
const API_KEY = RAW_KEY || "DEMO_KEY";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_LIMIT = 12;
const BATCH = 4;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TYPE_SLUG: Record<string, string> = {
  hr: "house-bill", s: "senate-bill", hres: "house-resolution",
  sres: "senate-resolution", hjres: "house-joint-resolution",
  sjres: "senate-joint-resolution",
};

interface BillRef { congress: number; type: string; number: string }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function publicUrl(congress: number, type: string, number: string) {
  return `https://www.congress.gov/bill/${congress}th-congress/${TYPE_SLUG[type] ?? type}/${number}`;
}

const SYSTEM = `You write short, neutral summaries of US federal legislation for a civics app.

For each bill you receive its official title, sponsor, policy area and latest recorded action. Those are your ONLY facts.

Return a JSON array, one object per input, same order, each with:
  "whatHappened" — 1-2 sentences stating what the bill would do and where it currently stands, based only on the fields given
  "whyItMatters" — 1-2 sentences on who is affected and how, in general terms

Rules you must not break:
- Never state a fact not present in the fields. No amounts, vote counts, dates, outcomes or provisions that aren't there.
- A bill that has been introduced or referred has NOT passed. Never imply it has.
- Never say whether the bill is good, bad, likely to pass, or who supports or opposes it.
- Never characterise the sponsor's party or motives.
- If the title is too vague to describe, say plainly that the bill's text sets out the detail.
- Plain sentences. No markdown.

Return only the JSON array.`;

async function summarize(
  bills: { title: string; sponsor: string; policyArea: string; latestAction: string }[]
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
  if (!res.ok) return { items: [], why: `anthropic ${res.status}: ${(await res.text()).slice(0, 160)}` };
  const data = await res.json();
  // Concatenate every text block rather than assuming block 0. The response
  // can lead with a non-text block, and indexing blindly yielded an empty
  // string with stop_reason=end_turn — a silent, total failure.
  const text: string = (data.content ?? [])
    .filter((c: any) => c?.type === "text" && typeof c.text === "string")
    .map((c: any) => c.text)
    .join("");
  const a = text.indexOf("["), b = text.lastIndexOf("]");
  if (a < 0 || b < 0) {
    return { items: [], why: `no JSON array; stop=${data.stop_reason}; blocks=${(data.content ?? []).map((c: any) => c?.type).join(",")}; head="${text.slice(0, 120)}"` };
  }
  try {
    return { items: JSON.parse(text.slice(a, b + 1)) };
  } catch (e) {
    return { items: [], why: `parse failed; stop=${data.stop_reason}; tail="${text.slice(-120)}"` };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY is not set." }, 500);
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || DEFAULT_LIMIT, 30);

    const listRes = await fetch(
      `https://api.congress.gov/v3/bill?api_key=${API_KEY}&format=json&limit=${limit}&sort=updateDate+desc`,
      { signal: AbortSignal.timeout(30000) }
    );
    // Surfaced rather than swallowed: a throttled key must not look like a
    // quiet week in Congress.
    if (!listRes.ok) {
      return json({ error: `congress.gov list failed`, status: listRes.status, usingDemoKey: !RAW_KEY }, 502);
    }

    const refs: BillRef[] = ((await listRes.json()).bills ?? []).map((b: any) => ({
      congress: Number(b.congress), type: String(b.type).toLowerCase(), number: String(b.number),
    }));

    const ids = refs.map((r) => `congress-${r.congress}-${r.type}-${r.number}`);
    const { data: existing } = await supabase.from("stories").select("external_id").in("external_id", ids);
    const have = new Set((existing ?? []).map((r) => r.external_id));
    const todo = refs.filter((r) => !have.has(`congress-${r.congress}-${r.type}-${r.number}`));

    let inserted = 0, failed = 0;
    // api.data.gov publishes remaining quota on every response. Reading it
    // turns "8 failed" into a stated reason, and lets the run stop cleanly
    // instead of burning the rest of the batch against a spent limit.
    let rateRemaining: number | null = null;
    let stoppedOnRateLimit = false;
    const trace: unknown[] = [];

    for (let i = 0; i < todo.length; i += BATCH) {
      const slice = todo[Symbol.iterator] ? todo.slice(i, i + BATCH) : [];
      const details: any[] = [];

      for (const r of slice) {
        try {
          const res = await fetch(
            `https://api.congress.gov/v3/bill/${r.congress}/${r.type}/${r.number}?api_key=${API_KEY}&format=json`,
            { signal: AbortSignal.timeout(25000) }
          );
          const rem = res.headers.get("x-ratelimit-remaining");
          if (rem !== null) rateRemaining = Number(rem);
          if (res.status === 429) { stoppedOnRateLimit = true; break; }
          if (!res.ok) { failed++; continue; }
          const bill = (await res.json()).bill;
          if (bill?.title) details.push({ ref: r, bill });
        } catch { failed++; }
      }
      if (stoppedOnRateLimit && details.length === 0) break;
      if (details.length === 0) { trace.push({ stage: 'detail', got: 0, of: slice.length }); continue; }

      const summarized = await summarize(
        details.map(({ bill }) => ({
          title: bill.title,
          sponsor: bill.sponsors?.[0]
            ? `${bill.sponsors[0].fullName}`
            : "Sponsor not listed",
          policyArea: bill.policyArea?.name ?? "Not assigned",
          latestAction: bill.latestAction?.text ?? "No action recorded",
        }))
      );

      const summaries = summarized.items;
      trace.push({ stage: 'summarize', details: details.length, summaries: summaries.length, why: summarized.why });

      for (let j = 0; j < details.length; j++) {
        const { ref, bill } = details[j];
        const sum = summaries[j];
        if (!sum?.whatHappened) { failed++; continue; }

        const sponsor = bill.sponsors?.[0];
        const when = bill.latestAction?.actionDate
          ? new Date(bill.latestAction.actionDate).toISOString()
          : new Date().toISOString();

        const { data: story, error } = await supabase
          .from("stories")
          .insert({
            external_id: `congress-${ref.congress}-${ref.type}-${ref.number}`,
            source_system: "congress",
            topic: bill.policyArea?.name ?? "Congress",
            scope: "Federal",
            state: null,
            headline: String(bill.title).slice(0, 200),
            what_happened: sum.whatHappened,
            why_it_matters: sum.whyItMatters,
            // Read from the record, never generated.
            status: bill.latestAction?.text ?? "No action recorded",
            sponsor: sponsor ? sponsor.fullName : "Sponsor not listed",
            cosponsors: `${bill.cosponsors?.count ?? 0} cosponsors`,
            next_checkpoint: "Not yet determined — check latest action",
            fiscal_note: "Not yet scored",
            what_is_uncertain:
              "Summarised from the bill's official title and latest action; the bill text sets out the detail.",
            published_at: when,
            updated_at: when,
          })
          .select("id")
          .single();
        if (error || !story) { failed++; trace.push({ stage: 'insert', error: error?.message }); continue; }

        await supabase.from("sources").insert({
          story_id: story.id,
          label: `Bill text · ${ref.type.toUpperCase()} ${ref.number}`,
          type: "Primary source",
          domain: "congress.gov",
          url: publicUrl(ref.congress, ref.type, ref.number),
        });
        inserted++;
      }
    }

    return json({
      ok: true,
      considered: refs.length,
      alreadyHad: have.size,
      inserted,
      failed,
      rateRemaining,
      stoppedOnRateLimit,
      usingDemoKey: !RAW_KEY,
      ...(stoppedOnRateLimit
        ? { note: "Stopped early: api.data.gov rate limit reached. Set DATA_GOV_API_KEY for a real quota." }
        : {}),
      ...(body.debug ? { trace } : {}),
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
