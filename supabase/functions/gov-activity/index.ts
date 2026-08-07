// What the reader's own members of Congress have actually done.
//
// Congress.gov exposes legislation per member, keyed by bioguide ID — which is
// the same identifier 5 Calls returns and we already store as external_id, so
// the join needs no extra lookup.
//
// Sponsorship and cosponsorship only. Roll-call votes are a separate pipeline
// (the House vote endpoint doesn't cover the Senate) and are deliberately not
// guessed at here: a vote we can't source is left out rather than inferred.
//
// Deploy:  supabase functions deploy gov-activity
// Secrets: DATA_GOV_API_KEY
const RAW_KEY = Deno.env.get("DATA_GOV_API_KEY");
const API_KEY = RAW_KEY || "DEMO_KEY";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEOUT_MS = 8000;
const PER_MEMBER = 6;
const MAX_MEMBERS = 3;

export type RelationshipType = "sponsored" | "cosponsored";

interface ActivityItem {
  bioguideId: string;
  relationshipType: RelationshipType;
  congress: number;
  billType: string;
  billNumber: string;
  citation: string;
  title: string;
  latestAction: string | null;
  latestActionDate: string | null;
  policyArea: string | null;
  url: string;
}

const TYPE_LABELS: Record<string, string> = {
  hr: "H.R.",
  s: "S.",
  hres: "H.Res.",
  sres: "S.Res.",
  hjres: "H.J.Res.",
  sjres: "S.J.Res.",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function billUrl(congress: number, type: string, number: string): string {
  const slug =
    type === "hr" ? "house-bill" : type === "s" ? "senate-bill" : type === "hres" ? "house-resolution" : type;
  return `https://www.congress.gov/bill/${congress}th-congress/${slug}/${number}`;
}

async function fetchLegislation(
  bioguideId: string,
  relationship: RelationshipType
): Promise<ActivityItem[]> {
  const path = relationship === "sponsored" ? "sponsored-legislation" : "cosponsored-legislation";
  const key = relationship === "sponsored" ? "sponsoredLegislation" : "cosponsoredLegislation";
  try {
    const res = await fetch(
      `https://api.congress.gov/v3/member/${bioguideId}/${path}?api_key=${API_KEY}&limit=${PER_MEMBER}&format=json`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!res.ok) return [];
    const items = (await res.json())?.[key] ?? [];

    return items
      .filter((b: any) => b?.title && b?.type && b?.number && b?.congress)
      .map((b: any) => {
        const type = String(b.type).toLowerCase();
        return {
          bioguideId,
          relationshipType: relationship,
          congress: Number(b.congress),
          billType: type,
          billNumber: String(b.number),
          citation: `${TYPE_LABELS[type] ?? String(b.type)} ${b.number}`,
          title: b.title,
          latestAction: b.latestAction?.text ?? null,
          latestActionDate: b.latestAction?.actionDate ?? null,
          policyArea: b.policyArea?.name ?? null,
          url: billUrl(Number(b.congress), type, String(b.number)),
        } as ActivityItem;
      });
  } catch {
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const { bioguideIds } = await req.json();
    if (!Array.isArray(bioguideIds) || bioguideIds.length === 0) {
      return json({ activity: [], usingDemoKey: !RAW_KEY });
    }

    // Bounded: this is 2 upstream calls per member, and the quota is shared.
    const ids = bioguideIds
      .filter((id: unknown) => typeof id === "string" && /^[A-Z]\d{6}$/.test(id))
      .slice(0, MAX_MEMBERS);

    const batches = await Promise.all(
      ids.flatMap((id: string) => [
        fetchLegislation(id, "sponsored"),
        fetchLegislation(id, "cosponsored"),
      ])
    );

    // Newest first across every member, so the strip reads as a single feed of
    // recent activity rather than one block per official.
    const activity = batches
      .flat()
      .sort((a, b) => (b.latestActionDate ?? "").localeCompare(a.latestActionDate ?? ""));

    return json({ activity, usingDemoKey: !RAW_KEY });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
