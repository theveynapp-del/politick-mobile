// Roll-call votes for both chambers.
//
// gov-activity covers what a member sponsored. This covers how they voted,
// which is the larger and more revealing record — a member votes on hundreds
// of measures and sponsors a handful.
//
// The two chambers publish in completely different ways:
//
//   House  — api.congress.gov /house-vote, and /members on each roll call,
//            which returns every voting member keyed by bioguideID. A direct
//            join to what we already store.
//
//   Senate — senate.gov XML. No bioguide anywhere in it, and senate.gov
//            refuses requests from datacenter IPs, so the Edge Function can't
//            reach it at all. The resolver below is kept because it works and
//            the block is the only thing in the way.
//
// The model rephrases the official question into plain language and does
// nothing else. Vote counts, results, positions and dates are copied from the
// record — a vote is the last thing that should ever be inferred.
//
// Deploy:  supabase functions deploy sync-votes
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

// Edge Functions have a 150s wall clock and each House roll call costs a
// ~430-member fetch plus a bill lookup, so a run takes a bounded slice and the
// schedule catches up.
const HOUSE_PER_RUN = 5;
const SENATE_PER_RUN = 6;
const SUMMARY_BATCH = 8;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : null;
}

const SENATE_HEADERS = {
  "User-Agent": "RotundaBot/1.0 (+https://rotundaapp.com; civic data ingest)",
  Accept: "application/xml,text/xml,*/*",
};

const SYSTEM = `You rewrite US congressional roll-call votes into plain language for a civics app.

For each vote you receive the chamber, the official question, the bill citation, and the bill's official title if there is one. Those are your ONLY facts.

Return a JSON array, one object per input, same order, each with:
  "plain" — ONE sentence, max 30 words, saying what the chamber was deciding AND what the measure is about, in words an ordinary person uses

Rules you must not break:
- Describe only the DECISION IN FRONT OF THE CHAMBER. Never state or imply the outcome, the tally, or who won.
- Never state a fact not present in the fields. No amounts, dates, sponsors or provisions that aren't there.
- Never say whether the measure is good or bad, and never characterise a party or a motive.
- Procedural votes are common. "Cloture" means a vote on whether to end debate and move to a final vote — say that plainly rather than using the word.
- If a bill title is given, say what the bill is about. Never restate a bare citation like "bill HR 3424" as if it were a description.
- If there is no title and the question is too vague to describe, say plainly that it was a procedural step on a named measure.
- Plain sentence. No markdown.

Return only the JSON array.`;

async function summarize(
  votes: { chamber: string; question: string; citation: string; billTitle: string }[]
): Promise<string[]> {
  if (!ANTHROPIC_API_KEY || votes.length === 0) return [];
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
        max_tokens: 2000,
        system: SYSTEM,
        messages: [{ role: "user", content: JSON.stringify(votes) }],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return [];
    const text = textFrom(await res.json());
    const a = text.indexOf("["), b = text.lastIndexOf("]");
    if (a < 0 || b < 0) return [];
    return (JSON.parse(text.slice(a, b + 1)) as { plain: string }[]).map((x) => x?.plain ?? "");
  } catch {
    return [];
  }
}

/**
 * lastName|STATE -> bioguide, for resolving Senate votes.
 *
 * Two senators per state means a last name collides only if a state seats two
 * senators with the same surname, which has not happened in the modern era.
 */
async function senateBioguideMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let offset = 0; offset < 600; offset += 250) {
    const res = await fetch(
      `https://api.congress.gov/v3/member?api_key=${API_KEY}&format=json&currentMember=true&limit=250&offset=${offset}`,
      { signal: AbortSignal.timeout(20000) }
    );
    if (!res.ok) break;
    const members = (await res.json()).members ?? [];
    if (members.length === 0) break;
    for (const m of members) {
      const bioguide = m?.bioguideId;
      const state = m?.state;
      // "Baldwin, Tammy" -> "baldwin"
      const last = String(m?.name ?? "").split(",")[0].trim().toLowerCase();
      if (bioguide && state && last) map.set(`${last}|${state}`, bioguide);
    }
  }
  return map;
}

async function ingestHouse(existing: Set<string>) {
  let inserted = 0, votesWritten = 0;
  const listRes = await fetch(
    `https://api.congress.gov/v3/house-vote?api_key=${API_KEY}&format=json&limit=20`,
    { signal: AbortSignal.timeout(25000) }
  );
  if (!listRes.ok) return { inserted, votesWritten, error: `house list ${listRes.status}` };

  const all = ((await listRes.json()).houseRollCallVotes ?? []) as any[];
  const todo = all
    .filter((v) => !existing.has(`House|${v.congress}|${v.sessionNumber}|${v.rollCallNumber}`))
    .slice(0, HOUSE_PER_RUN);

  for (const v of todo) {
    const memRes = await fetch(
      `https://api.congress.gov/v3/house-vote/${v.congress}/${v.sessionNumber}/${v.rollCallNumber}/members?api_key=${API_KEY}&format=json`,
      { signal: AbortSignal.timeout(25000) }
    );
    if (!memRes.ok) continue;
    const members = ((await memRes.json()).houseRollCallVoteMemberVotes?.results ?? []) as any[];
    if (members.length === 0) continue;

    const citation = v.legislationType && v.legislationNumber
      ? `${v.legislationType} ${v.legislationNumber}`
      : null;

    // One extra request per roll call, and the only thing that makes the
    // summary describe a subject rather than restate a number.
    let billTitle: string | null = null;
    if (v.legislationType && v.legislationNumber) {
      try {
        const bRes = await fetch(
          `https://api.congress.gov/v3/bill/${v.congress}/${String(v.legislationType).toLowerCase()}/${v.legislationNumber}?api_key=${API_KEY}&format=json`,
          { signal: AbortSignal.timeout(20000) }
        );
        if (bRes.ok) billTitle = (await bRes.json())?.bill?.title ?? null;
      } catch { /* title is a nicety; the vote still stands without it */ }
    }

    const { data: rc, error } = await supabase
      .from("roll_calls")
      .insert({
        chamber: "House",
        congress: v.congress,
        session: v.sessionNumber,
        roll_number: v.rollCallNumber,
        question: v.voteType ?? "Recorded vote",
        bill_citation: citation,
        bill_title: billTitle,
        bill_url: v.legislationUrl ?? null,
        result: v.result ?? null,
        voted_at: v.startDate,
        source_url: v.sourceDataURL ?? `https://clerk.house.gov/Votes/${v.rollCallNumber}`,
      })
      .select("id")
      .single();
    if (error || !rc) continue;
    inserted++;

    const rows = members
      .filter((m) => m?.bioguideID && m?.voteCast)
      .map((m) => ({ roll_call_id: rc.id, bioguide_id: m.bioguideID, vote_cast: m.voteCast }));
    if (rows.length > 0) {
      await supabase.from("member_votes").upsert(rows, { onConflict: "roll_call_id,bioguide_id" });
      votesWritten += rows.length;
    }
  }
  return { inserted, votesWritten };
}

async function ingestSenate(existing: Set<string>, bioguide: Map<string, string>) {
  let inserted = 0, votesWritten = 0, unresolved = 0;
  const congress = 119, session = 2;

  const menuRes = await fetch(
    `https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_${congress}_${session}.xml`,
    { headers: SENATE_HEADERS, signal: AbortSignal.timeout(25000) }
  );
  if (!menuRes.ok) return { inserted, votesWritten, unresolved, error: `senate menu ${menuRes.status}` };

  const menu = await menuRes.text();
  const numbers = [...menu.matchAll(/<vote_number>(\d+)<\/vote_number>/g)]
    .map((m) => Number(m[1]))
    .sort((a, b) => b - a)
    .filter((n) => !existing.has(`Senate|${congress}|${session}|${n}`))
    .slice(0, SENATE_PER_RUN);

  for (const n of numbers) {
    const padded = String(n).padStart(5, "0");
    const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${congress}${session}/vote_${congress}_${session}_${padded}.xml`;
    const res = await fetch(url, { headers: SENATE_HEADERS, signal: AbortSignal.timeout(25000) });
    if (!res.ok) continue;
    const xml = await res.text();

    const question = tag(xml, "vote_question_text") ?? tag(xml, "question") ?? "Recorded vote";
    const dateRaw = tag(xml, "vote_date");
    const parsed = dateRaw ? new Date(dateRaw) : null;
    const votedAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
    const citation = tag(xml, "document_name") ?? tag(xml, "issue");

    const { data: rc, error } = await supabase
      .from("roll_calls")
      .insert({
        chamber: "Senate",
        congress,
        session,
        roll_number: n,
        question,
        bill_citation: citation,
        bill_title: tag(xml, "title"),
        bill_url: null,
        result: tag(xml, "vote_result") ?? null,
        voted_at: votedAt,
        source_url: url,
      })
      .select("id")
      .single();
    if (error || !rc) continue;
    inserted++;

    const rows: { roll_call_id: string; bioguide_id: string; vote_cast: string }[] = [];
    for (const block of xml.matchAll(/<member>([\s\S]*?)<\/member>/g)) {
      const m = block[1];
      const last = tag(m, "last_name")?.toLowerCase();
      const state = tag(m, "state");
      const cast = tag(m, "vote_cast");
      if (!last || !state || !cast) continue;
      const id = bioguide.get(`${last}|${state}`);
      // Unresolved is counted, not silently dropped: a senator we can't key is
      // a senator whose record would quietly go missing from the app.
      if (!id) { unresolved++; continue; }
      rows.push({ roll_call_id: rc.id, bioguide_id: id, vote_cast: cast });
    }
    if (rows.length > 0) {
      await supabase.from("member_votes").upsert(rows, { onConflict: "roll_call_id,bioguide_id" });
      votesWritten += rows.length;
    }
  }
  return { inserted, votesWritten, unresolved };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const body = await req.json().catch(() => ({}));

    const { data: have } = await supabase
      .from("roll_calls")
      .select("chamber, congress, session, roll_number");
    const existing = new Set(
      (have ?? []).map((r) => `${r.chamber}|${r.congress}|${r.session}|${r.roll_number}`)
    );

    const house = body.chamber === "senate" ? { inserted: 0, votesWritten: 0 } : await ingestHouse(existing);

    let senate: any = { inserted: 0, votesWritten: 0, unresolved: 0 };
    if (body.chamber === "senate") {
      const map = await senateBioguideMap();
      senate = await ingestSenate(existing, map);
      senate.mapSize = map.size;
    }

    // Plain-language pass over anything still missing one, including rows from
    // earlier runs where the model call failed.
    let summarized = 0;
    const { data: pending } = await supabase
      .from("roll_calls")
      .select("id, chamber, question, bill_citation, bill_title")
      .is("plain_summary", null)
      .order("voted_at", { ascending: false })
      .limit(SUMMARY_BATCH);

    if (pending && pending.length > 0) {
      const plains = await summarize(
        pending.map((p) => ({
          chamber: p.chamber,
          question: p.question,
          citation: p.bill_citation ?? "",
          billTitle: p.bill_title ?? "",
        }))
      );
      for (let i = 0; i < pending.length; i++) {
        const plain = plains[i];
        if (!plain) continue;
        await supabase.from("roll_calls").update({ plain_summary: plain }).eq("id", pending[i].id);
        summarized++;
      }
    }

    return json({ ok: true, house, senate, summarized, usingDemoKey: !RAW_KEY });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
