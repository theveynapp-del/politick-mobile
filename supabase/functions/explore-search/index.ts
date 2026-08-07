// Politick Explore search — grounded synthesis over ingested stories only.
// Never answers from open knowledge: everything in the answer comes from the
// story records passed as context.
//
// Deploy:  supabase functions deploy explore-search
// Secrets: ANTHROPIC_API_KEY (SUPABASE_* are injected)
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NEEDS_REVIEW_MARKER = "NEEDS_EDITORIAL_REVIEW";

// Fetched wide, then narrowed by state and re-ranked. Filtering after a small
// LIMIT would starve the result set: the newest five matches nationwide can
// easily all be another state's local stories.
const CANDIDATE_LIMIT = 30;
const ANSWER_CONTEXT = 5;
const RESULT_LIMIT = 6;
const MAX_QUERY_LENGTH = 200;

interface StoryRow {
  id: string;
  headline: string;
  topic: string;
  scope: string;
  state: string | null;
  what_happened: string;
  why_it_matters: string;
  status: string | null;
  sponsor: string | null;
  cosponsors: string | null;
  updated_at: string;
}

/**
 * Same rule the Today feed uses: Federal and World stories apply everywhere,
 * Local and State stories only exist for the states actually ingested and are
 * shown only to readers in that state. Explore has to agree with Today about
 * what counts as local to you, or the two screens contradict each other.
 */
function inScope(row: StoryRow, stateName: string | null): boolean {
  if (row.scope === "Federal" || row.scope === "World") return true;
  return !!stateName && row.state === stateName;
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 4);
}

/**
 * Onboarding topics ("Healthcare", "Housing") don't match story topics
 * ("Health", "Housing and Community Development") exactly, so overlap is
 * checked on stems in both directions. This only boosts ranking — a story is
 * never hidden for failing to match an interest.
 */
function matchesInterests(row: StoryRow, interests: string[]): boolean {
  if (interests.length === 0) return false;
  const storyTokens = tokens(`${row.topic} ${row.headline}`);
  return interests.some((interest) =>
    tokens(interest).some((it) => storyTokens.some((st) => st.startsWith(it) || it.startsWith(st)))
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  try {
    const { query, state, topics } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return json({ error: "Missing query" }, 400);
    }

    // Bounded because this endpoint spends money on every call.
    const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH);
    const stateName: string | null = typeof state === "string" && state ? state : null;
    const interests: string[] = Array.isArray(topics) ? topics.filter((t) => typeof t === "string") : [];

    if (!ANTHROPIC_API_KEY) {
      return json({ error: "ANTHROPIC_API_KEY is not set on this Edge Function." }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const term = `%${trimmed}%`;

    const { data, error } = await supabase
      .from("stories")
      .select(
        "id, headline, topic, scope, state, what_happened, why_it_matters, status, sponsor, cosponsors, updated_at"
      )
      .or(
        `headline.ilike.${term},topic.ilike.${term},what_happened.ilike.${term},why_it_matters.ilike.${term}`
      )
      .order("updated_at", { ascending: false })
      .limit(CANDIDATE_LIMIT);

    if (error) return json({ error: error.message }, 500);

    const all = (data ?? []) as StoryRow[];
    const scoped = all.filter((row) => inScope(row, stateName));

    if (scoped.length === 0) {
      // Distinguishes "nothing exists" from "nothing that applies to you",
      // which are different problems for the reader.
      const message =
        all.length > 0
          ? `We have coverage of "${trimmed}", but none of it applies to your area yet.`
          : `No stories on "${trimmed}" yet — we're adding coverage daily.`;
      return json({ found: false, message });
    }

    // Interests lift a story up the list; they never remove one.
    const ranked = [...scoped].sort((a, b) => {
      const ai = matchesInterests(a, interests) ? 0 : 1;
      const bi = matchesInterests(b, interests) ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return b.updated_at.localeCompare(a.updated_at);
    });

    const context = ranked
      .slice(0, ANSWER_CONTEXT)
      .map((s, i) => {
        const why = s.why_it_matters?.includes(NEEDS_REVIEW_MARKER)
          ? "(editorial analysis not yet completed for this story)"
          : s.why_it_matters;
        return [
          `Story ${i + 1}:`,
          `Headline: ${s.headline}`,
          `Scope: ${s.scope} | Topic: ${s.topic}`,
          `What happened: ${s.what_happened}`,
          `Why it matters: ${why}`,
          `Status: ${s.status ?? "unknown"}`,
          s.sponsor ? `Sponsor: ${s.sponsor}` : null,
          s.cosponsors ? `Cosponsors: ${s.cosponsors}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");

    const systemPrompt = `You are answering a question inside Politick, a civic app that only shows real, sourced government data. You will be given real story records already ingested from Congress.gov and other official sources. Answer the user's question using ONLY the information in these records — never add outside knowledge, never speculate about facts not present, never assume anything about the bill beyond what's given. If the records don't fully answer the question, say so plainly rather than filling the gap. Write in plain, conversational language — 2-4 short sentences, like you're explaining it to a friend who asked "what's this about?" at dinner. Do not use markdown formatting.`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: "user", content: `Question: ${trimmed}\n\nReal story records:\n\n${context}` }],
      }),
    });

    if (!anthropicRes.ok) {
      return json({ error: `Claude API failed: ${await anthropicRes.text()}` }, 500);
    }

    const anthropicData = await anthropicRes.json();

    return json({
      found: true,
      answer: anthropicData.content?.[0]?.text ?? "",
      // Returned in full so the app can show what the answer was built from
      // and let the reader open any of it, rather than ending at the prose.
      stories: ranked.slice(0, RESULT_LIMIT).map((s) => ({
        id: s.id,
        headline: s.headline,
        scope: s.scope,
        topic: s.topic,
      })),
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
