// Plain-language definitions of civic, legal and policy terms.
//
// This is the one place in the app where the model answers without a story
// behind it, so the boundary is drawn hard: it may explain what a term *means*
// and how the mechanism works, and nothing else. Anything about who holds
// office, what is happening now, what a particular bill does, or whether any
// of it is good or bad stays off limits — those are claims that need a source,
// and this lane has none.
//
// Deploy:  supabase functions deploy define-term
// Secrets: ANTHROPIC_API_KEY
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_QUERY_LENGTH = 120;
const NOT_CIVIC = "NOT_CIVIC";

const SYSTEM = `You define civic, legal, governmental and public-policy terms for readers of Politick, a nonpartisan US civics app.

Given a term or a question about one, explain in 2-4 short plain sentences:
- what the term means
- how the mechanism actually works, or why it matters procedurally

Hard limits. You must never:
- name or describe any current officeholder, candidate, party or administration
- describe current events, pending legislation, or anything happening now
- state what any person, party or group wants, believes or intends
- predict what will happen
- say whether anything is good, bad, effective or justified
- cite sources, statistics, dates or figures

Write timeless, procedural, politically neutral explanation only — the kind of thing that would have been equally true ten years ago and will be in ten years.

If the input is not a civic, legal, governmental or policy concept — for example a person's name, a product, a place, or general trivia — reply with exactly ${NOT_CIVIC} and nothing else.

Plain sentences. No markdown, no lists, no headings.`;

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

/** "What is a moratorium?" -> "moratorium", for display as a heading. */
function extractTerm(query: string): string {
  const t = query
    .trim()
    .replace(/^(what|whats|what's)\s+(is|are|does|do)\s+(a|an|the)?\s*/i, "")
    .replace(/\s+(mean|means|meaning)\??$/i, "")
    .replace(/[?.!]+$/, "")
    .trim();
  return t || query.trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || !query.trim()) {
      return json({ error: "Missing query" }, 400);
    }
    if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY is not set." }, 500);

    const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH);
    const term = extractTerm(trimmed);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 300,
        system: SYSTEM,
        messages: [{ role: "user", content: trimmed }],
      }),
    });

    if (!res.ok) return json({ error: `Claude API failed: ${await res.text()}` }, 500);

    const data = await res.json();
    const text = textFrom(data).trim();

    if (!text || text.includes(NOT_CIVIC)) {
      return json({ found: false, term });
    }
    return json({ found: true, term, definition: text });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
