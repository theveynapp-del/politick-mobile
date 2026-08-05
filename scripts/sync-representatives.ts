/**
 * Real data ingestion from the 5 Calls Representatives API into the
 * Politick Supabase schema.
 *
 * Run with: npm run sync:reps -- 20814
 * (pass one or more ZIP codes as args — this only fetches reps for ZIPs
 * you actually want covered, not a nationwide crawl)
 *
 * Requires (server-only, never NEXT_PUBLIC_-prefixed):
 *   FIVE_CALLS_TOKEN          — the token you requested from 5calls.org
 *   SUPABASE_SERVICE_ROLE_KEY — same one used by sync-congress.ts
 *
 * NOTE ON SCHEMA: this script assumes two columns exist on `representatives`
 * that aren't in the original schema. If you haven't run this migration yet,
 * run it first in the Supabase SQL editor:
 *
 *   alter table representatives add column photo_url text;
 *   alter table representatives add column external_id text unique;
 *
 * (external_id stores 5 Calls' own id — Bioguide ID for federal reps — so
 * re-running this script updates existing reps instead of duplicating them.)
 *
 * COVERAGE NOTE: 5 Calls covers US House, US Senate, Governor, Secretary
 * of State, and Attorneys General — i.e. Federal + State-executive. It
 * does NOT cover state legislators or local/county officials (our schema's
 * "Local" and much of "State" tier). That gap is still open — worth
 * deciding whether OpenStates (state legislators) or manual local curation
 * fills it, separately from this script.
 */

import { createClient } from "@supabase/supabase-js";

const FIVE_CALLS_TOKEN = process.env.FIVE_CALLS_TOKEN;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const zips = process.argv.slice(2);

if (!FIVE_CALLS_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required env vars: FIVE_CALLS_TOKEN, EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (zips.length === 0) {
  console.error("Pass at least one ZIP code, e.g.: npm run sync:reps -- 20814 90210");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Maps 5 Calls' `area` values to our schema's RepLevel + a plain-language
// role/controls description, per the editorial policy's "explain what the
// office controls before listing activity" rule.
const AREA_MAP: Record<string, { level: "Federal" | "State"; role: string; controls: string }> = {
  "US House": { level: "Federal", role: "US House representative", controls: "Federal laws and spending" },
  "US Senate": { level: "Federal", role: "US Senator", controls: "Senate votes and confirmations" },
  Governor: { level: "State", role: "Governor", controls: "State executive actions, state budget signing, appointments" },
  SecState: { level: "State", role: "Secretary of State", controls: "State elections administration, official records" },
  AttorneysGeneral: { level: "State", role: "Attorney General", controls: "State legal enforcement, consumer protection" },
};

interface FiveCallsRep {
  id: string;
  name: string;
  phone: string;
  url?: string;
  photoURL?: string;
  party: string;
  state: string;
  district?: string;
  reason: string;
  area: string;
}

interface FiveCallsResponse {
  location: string;
  lowAccuracy: boolean;
  state: string;
  district: string;
  representatives: FiveCallsRep[];
  error?: string;
}

async function fetchReps(zip: string): Promise<FiveCallsResponse> {
  const res = await fetch(`https://api.5calls.org/v1/representatives?location=${zip}`, {
    headers: { "X-5Calls-Token": FIVE_CALLS_TOKEN! },
  });
  if (!res.ok) throw new Error(`5 Calls API failed for ${zip}: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as FiveCallsResponse;
  if (data.error) throw new Error(`5 Calls error for ${zip}: ${data.error}`);
  return data;
}

async function main() {
  let totalInserted = 0;
  let totalLinked = 0;

  for (const zip of zips) {
    console.log(`\nFetching representatives for ZIP ${zip}...`);
    const data = await fetchReps(zip);

    if (data.lowAccuracy) {
      console.warn(`  Warning: low-accuracy match for ${zip} — may span multiple districts.`);
    }

    for (const rep of data.representatives) {
      const mapping = AREA_MAP[rep.area];
      if (!mapping) {
        console.log(`  Skipping ${rep.name} — unmapped area "${rep.area}" (state legislature not yet supported).`);
        continue;
      }

      // Upsert by 5 Calls' own id (Bioguide ID for federal reps) so re-runs
      // don't create duplicates as ZIPs overlap on the same representative.
      const { data: existing } = await supabase
        .from("representatives")
        .select("id")
        .eq("external_id", rep.id)
        .maybeSingle();

      let repId: string;

      if (existing) {
        repId = existing.id;
        await supabase
          .from("representatives")
          .update({
            name: rep.name,
            photo_url: rep.photoURL ?? null,
          })
          .eq("id", repId);
      } else {
        const { data: inserted, error } = await supabase
          .from("representatives")
          .insert({
            level: mapping.level,
            role: mapping.role,
            controls: mapping.controls,
            name: rep.name,
            jurisdiction_confidence: data.lowAccuracy ? "Needs review" : "High",
            photo_url: rep.photoURL ?? null,
            external_id: rep.id,
          })
          .select("id")
          .single();

        if (error) {
          console.error(`  Failed to insert ${rep.name}:`, error.message);
          continue;
        }
        repId = inserted.id;
        totalInserted++;
        console.log(`  Inserted: ${rep.name} (${mapping.role})`);
      }

      const { data: existingLink } = await supabase
        .from("rep_zip_coverage")
        .select("zip")
        .eq("zip", zip)
        .eq("representative_id", repId)
        .maybeSingle();

      if (!existingLink) {
        await supabase.from("rep_zip_coverage").insert({ zip, representative_id: repId });
        totalLinked++;
      }
    }

    // Be a good citizen between ZIP lookups — not a documented rate limit,
    // just reasonable pacing for a nonprofit-run API.
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nDone. ${totalInserted} new representatives inserted, ${totalLinked} new ZIP-coverage links created.`);
  console.log(
    "Coverage gap, unchanged by this script: state legislators and local/county officials " +
    "still have no real data source wired in — that's the remaining piece."
  );
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
