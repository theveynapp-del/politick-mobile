// Federal bill lookup, straight from the official record.
//
// Two sources, because neither alone does the job:
//   - govinfo /search   — full text search over bill text (GPO). The
//     Congress.gov API has no keyword search: its `query` parameter is
//     silently ignored and returns the same unfiltered list.
//   - Congress.gov /bill — the structured record for one bill (sponsor,
//     latest action, policy area, canonical URL). No search, but exact
//     lookup is reliable.
//
// A govinfo packageId encodes congress/type/number ("BILLS-118hr8604ih"),
// which is the join key between the two.
//
// Deploy:  supabase functions deploy bill-search
// Secrets: DATA_GOV_API_KEY (one key covers both api.congress.gov and
//          api.govinfo.gov — free at https://api.data.gov/signup/)
const RAW_KEY = Deno.env.get("DATA_GOV_API_KEY");
// DEMO_KEY works but is shared and throttled to a few dozen calls an hour.
// Fine for a smoke test, not for real traffic.
const API_KEY = RAW_KEY || "DEMO_KEY";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Enrichment is one request per result, so this bounds both latency and quota.
const MAX_RESULTS = 5;
const MAX_QUERY_LENGTH = 200;
const TIMEOUT_MS = 8000;

// Newest first — a bill from the current congress is what someone asking about
// "that thing I heard about" almost always means.
const CONGRESSES = [119, 118];

const BILL_TYPE_LABELS: Record<string, string> = {
  hr: "H.R.",
  s: "S.",
  hres: "H.Res.",
  sres: "S.Res.",
  hjres: "H.J.Res.",
  sjres: "S.J.Res.",
};

export interface BillResult {
  congress: number;
  type: string;
  number: string;
  citation: string;
  title: string;
  sponsor: string | null;
  latestAction: string | null;
  latestActionDate: string | null;
  policyArea: string | null;
  url: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** "HR 3684", "H.R.3684", "s. 1981" → { type: "hr", number: "3684" } */
function parseCitation(query: string): { type: string; number: string } | null {
  const m = query
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .match(/\b(hr|s|hres|sres|hjres|sjres)\s*(\d{1,5})\b/);
  if (!m) return null;
  return { type: m[1], number: m[2] };
}

/** "BILLS-118hr8604ih" → { congress: 118, type: "hr", number: "8604" } */
function parsePackageId(packageId: string): { congress: number; type: string; number: string } | null {
  const m = packageId.match(/^BILLS-(\d{3})([a-z]+?)(\d+)[a-z]*$/i);
  if (!m) return null;
  return { congress: Number(m[1]), type: m[2].toLowerCase(), number: m[3] };
}

async function fetchBill(congress: number, type: string, number: string): Promise<BillResult | null> {
  try {
    const res = await fetch(
      `https://api.congress.gov/v3/bill/${congress}/${type}/${number}?api_key=${API_KEY}&format=json`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!res.ok) return null;
    const bill = (await res.json())?.bill;
    if (!bill?.title) return null;

    return {
      congress,
      type,
      number,
      citation: `${BILL_TYPE_LABELS[type] ?? type.toUpperCase()} ${number}`,
      title: bill.title,
      sponsor: bill.sponsors?.[0]?.fullName ?? null,
      latestAction: bill.latestAction?.text ?? null,
      latestActionDate: bill.latestAction?.actionDate ?? null,
      policyArea: bill.policyArea?.name ?? null,
      url:
        bill.legislationUrl ??
        `https://www.congress.gov/bill/${congress}th-congress/${
          type === "hr" ? "house-bill" : type === "s" ? "senate-bill" : type
        }/${number}`,
    };
  } catch {
    return null;
  }
}

async function searchGovinfo(query: string): Promise<{ congress: number; type: string; number: string }[]> {
  const res = await fetch(`https://api.govinfo.gov/search?api_key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // Scoped to the two most recent congresses: older matches are usually
      // dead bills and crowd out anything currently moving.
      query: `collection:BILLS AND (congress:119 OR congress:118) AND ${query}`,
      pageSize: 20,
      offsetMark: "*",
      sorts: [{ field: "score", sortOrder: "DESC" }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return [];

  const results = (await res.json())?.results ?? [];
  const seen = new Set<string>();
  const out: { congress: number; type: string; number: string }[] = [];

  for (const r of results) {
    const parsed = parsePackageId(r.packageId ?? "");
    if (!parsed) continue;
    // The same bill appears once per version (ih, rh, es…); one entry each.
    const key = `${parsed.congress}-${parsed.type}-${parsed.number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed);
    if (out.length >= MAX_RESULTS) break;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || !query.trim()) {
      return json({ error: "Missing query" }, 400);
    }
    const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH);

    // A citation is unambiguous — go straight to the record rather than
    // full-text searching for the string "hr 3684".
    const citation = parseCitation(trimmed);
    if (citation) {
      for (const congress of CONGRESSES) {
        const bill = await fetchBill(congress, citation.type, citation.number);
        if (bill) return json({ bills: [bill], matchedCitation: true, usingDemoKey: !RAW_KEY });
      }
      return json({ bills: [], matchedCitation: true, usingDemoKey: !RAW_KEY });
    }

    const refs = await searchGovinfo(trimmed);
    const bills = (await Promise.all(refs.map((r) => fetchBill(r.congress, r.type, r.number)))).filter(
      (b): b is BillResult => b !== null
    );

    return json({ bills, matchedCitation: false, usingDemoKey: !RAW_KEY });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
