/**
 * Real data ingestion from Congress.gov API v3 into the Politick Supabase schema.
 *
 * Run with: npm run sync:congress
 *
 * Requires two env vars NOT already in .env.local (these are server-only,
 * never exposed to the client — do not prefix with NEXT_PUBLIC_):
 *   CONGRESS_API_KEY          — free, self-serve at https://api.congress.gov/sign-up/
 *   SUPABASE_SERVICE_ROLE_KEY — from Supabase dashboard → Project Settings → API
 *                                (the "service_role" secret key, NOT the anon/publishable key —
 *                                this bypasses RLS, which is required for a server-side sync job
 *                                to write into `stories`/`sources`, since those tables only have
 *                                SELECT policies for the public-facing anon key by design)
 *
 * HONEST LIMITATION, not glossed over: Congress.gov's API gives us real, verified
 * facts — title, sponsor, cosponsor count, latest action, status, the bill's own
 * primary-source URL. It does NOT give us "why this matters to you" — that's real
 * editorial synthesis, which the Politick editorial policy requires to be human-
 * reviewed regardless of whether a human or an AI drafts the first pass. This
 * script leaves `why_it_matters` and `zip_note` as an explicit placeholder string
 * rather than fabricating something that reads like real analysis — search for
 * NEEDS_EDITORIAL_REVIEW below to find every story that needs a human pass before
 * it's genuinely ready to show a user.
 */

import { createClient } from "@supabase/supabase-js";

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!CONGRESS_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing required env vars. Need CONGRESS_API_KEY, EXPO_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const NEEDS_EDITORIAL_REVIEW =
  "NEEDS_EDITORIAL_REVIEW — this is a real bill from Congress.gov, but no one has " +
  "written the plain-language \u201cwhy it matters\u201d synthesis yet. Do not ship this " +
  "story to users until a human has reviewed and filled this in.";

interface CongressBillListItem {
  congress: number;
  type: string; // "HR", "S", "HRES", etc.
  number: string;
  title: string;
  updateDate: string;
  latestAction?: { actionDate: string; text: string };
  url: string; // API detail URL, not the public congress.gov page
}

interface CongressBillDetail {
  bill: {
    congress: number;
    number: string;
    type: string;
    title: string;
    introducedDate: string;
    latestAction?: { actionDate: string; text: string };
    policyArea?: { name: string };
    sponsors?: { firstName: string; lastName: string; party: string; state: string }[];
    cosponsors?: { count: number };
  };
}

function publicBillUrl(congress: number, type: string, number: string) {
  const typeSlug: Record<string, string> = {
    HR: "house-bill",
    S: "senate-bill",
    HRES: "house-resolution",
    SRES: "senate-resolution",
    HJRES: "house-joint-resolution",
    SJRES: "senate-joint-resolution",
  };
  return `https://www.congress.gov/bill/${congress}th-congress/${typeSlug[type] ?? type.toLowerCase()}/${number}`;
}

async function fetchRecentBills(limit = 15): Promise<CongressBillListItem[]> {
  const url = `https://api.congress.gov/v3/bill?api_key=${CONGRESS_API_KEY}&format=json&limit=${limit}&sort=updateDate+desc`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Congress.gov bill list failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.bills as CongressBillListItem[];
}

async function fetchBillDetail(congress: number, type: string, number: string): Promise<CongressBillDetail> {
  const url = `https://api.congress.gov/v3/bill/${congress}/${type.toLowerCase()}/${number}?api_key=${CONGRESS_API_KEY}&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Congress.gov bill detail failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log("Fetching recent bills from Congress.gov...");
  const recent = await fetchRecentBills(15);
  console.log(`Got ${recent.length} bills. Fetching detail for each...`);

  let inserted = 0;

  for (const item of recent) {
    const detail = await fetchBillDetail(item.congress, item.type, item.number);
    const bill = detail.bill;

    const sponsor = bill.sponsors?.[0];
    const sponsorStr = sponsor ? `${sponsor.firstName} ${sponsor.lastName} (${sponsor.party}-${sponsor.state})` : "Sponsor not yet listed";
    const cosponsorCount = bill.cosponsors?.count ?? 0;

    const { data: existing } = await supabase
      .from("stories")
      .select("id")
      .eq("headline", bill.title)
      .maybeSingle();

    if (existing) {
      console.log(`Skipping "${bill.title}" — already ingested.`);
      continue;
    }

    const { data: storyRow, error: storyError } = await supabase
      .from("stories")
      .insert({
        topic: bill.policyArea?.name ?? "Congress",
        scope: "Federal",
        headline: bill.title,
        what_happened: `${bill.type} ${bill.number} was introduced on ${bill.introducedDate}. Latest action: ${bill.latestAction?.text ?? "No action recorded yet"} (${bill.latestAction?.actionDate ?? "date unknown"}).`,
        why_it_matters: NEEDS_EDITORIAL_REVIEW,
        status: bill.latestAction?.text ?? "Introduced",
        sponsor: sponsorStr,
        cosponsors: `${cosponsorCount} cosponsor${cosponsorCount === 1 ? "" : "s"}`,
        next_checkpoint: "Not yet determined — check latest action",
        fiscal_note: "Not yet scored",
      })
      .select("id")
      .single();

    if (storyError) {
      console.error(`Failed to insert "${bill.title}":`, storyError.message);
      continue;
    }

    await supabase.from("sources").insert({
      story_id: storyRow.id,
      label: `Bill text · ${bill.type} ${bill.number}`,
      type: "Primary source",
      domain: "congress.gov",
      url: publicBillUrl(bill.congress, bill.type, bill.number),
    });

    inserted++;
    console.log(`Inserted: "${bill.title}"`);

    // Congress.gov rate limit is 5,000/hour — this pause is just being a good
    // citizen for a sync job that isn't time-sensitive, not a required limit.
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\nDone. ${inserted} new real bills ingested.`);
  console.log(
    `IMPORTANT: every inserted story has why_it_matters set to a placeholder. ` +
    `Query for stories where why_it_matters = '${NEEDS_EDITORIAL_REVIEW}' and write the real synthesis before showing these to users.`
  );
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
