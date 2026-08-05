/**
 * Real data ingestion from the Cicero API (Azavea) — specifically for
 * STATE legislators and LOCAL/county officials, the two tiers 5 Calls
 * doesn't cover. This script deliberately does NOT pull Cicero's federal
 * or state-executive results, since sync-representatives.ts (5 Calls)
 * already owns Federal + Governor/SecState/AG — pulling those here too
 * would create duplicate representatives from two different sources.
 *
 * Run with: npm run sync:cicero -- 20814
 *
 * Requires (server-only, never EXPO_PUBLIC_-prefixed):
 *   CICERO_API_KEY            — from a Cicero free trial or paid account
 *                                (https://www.cicerodata.com/free-trial/)
 *   SUPABASE_SERVICE_ROLE_KEY — same one used by the other two sync scripts
 *
 * NOTE ON SCHEMA: uses the same photo_url and external_id columns added
 * for sync-representatives.ts. If those don't exist yet:
 *   alter table representatives add column photo_url text;
 *   alter table representatives add column external_id text unique;
 *
 * NOTE ON API AMBIGUITY, not glossed over: Cicero's docs show a postal-code
 * location query example for the `legislative_district` resource (which
 * wraps results in `candidates[].districts`), but do NOT show a postal-code
 * example for the `official` resource specifically — only lat/lon, which
 * returns a flatter `results.officials` array. This script queries `official`
 * with search_postal and handles BOTH possible response shapes defensively,
 * logging clearly if neither shape matches so a real run surfaces the issue
 * instead of silently returning nothing.
 *
 * COST NOTE: each ZIP lookup costs 1 credit (the `official` resource).
 * A free trial gives 1,000 credits — plenty to test broadly before paying.
 */

import { createClient } from "@supabase/supabase-js";

const CICERO_API_KEY = process.env.CICERO_API_KEY;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const zips = process.argv.slice(2);

if (!CICERO_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required env vars: CICERO_API_KEY, EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (zips.length === 0) {
  console.error("Pass at least one ZIP code, e.g.: npm run sync:cicero -- 20814");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Only these district types — federal and state-executive are owned by
// sync-representatives.ts (5 Calls) already.
const RELEVANT_DISTRICT_TYPES = new Set(["STATE_UPPER", "STATE_LOWER", "LOCAL", "LOCAL_EXEC"]);

interface CiceroAddress {
  phone_1?: string;
}

interface CiceroOffice {
  title: string;
  district: { district_type: string; city?: string; state?: string; label?: string };
  representing_city?: string;
  representing_state?: string;
}

interface CiceroOfficial {
  sk: number;
  first_name: string;
  last_name: string;
  middle_initial?: string;
  party?: string;
  photo_origin_url?: string;
  office: CiceroOffice;
  addresses?: CiceroAddress[];
}

interface CiceroResponse {
  response: {
    errors: string[];
    results: {
      officials?: CiceroOfficial[];
      candidates?: { officials?: CiceroOfficial[] }[];
    };
  };
}

async function fetchOfficials(zip: string): Promise<CiceroOfficial[]> {
  const url = `https://app.cicerodata.com/v3.1/official?search_postal=${zip}&search_country=US&format=json&key=${CICERO_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Cicero API failed for ${zip}: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as CiceroResponse;

  if (data.response.errors?.length) {
    throw new Error(`Cicero error for ${zip}: ${data.response.errors.join(", ")}`);
  }

  // Defensive handling of the documented ambiguity — see file header.
  if (data.response.results.officials) {
    return data.response.results.officials;
  }
  if (data.response.results.candidates?.[0]?.officials) {
    return data.response.results.candidates[0].officials;
  }

  console.warn(
    `  Warning: unrecognized response shape for ${zip}. Raw results keys: ` +
    `${Object.keys(data.response.results).join(", ")}. Skipping — check the Cicero docs ` +
    `for changes, or inspect the raw response manually.`
  );
  return [];
}

function levelFor(districtType: string): "State" | "Local" {
  return districtType.startsWith("STATE") ? "State" : "Local";
}

function controlsFor(districtType: string): string {
  if (districtType === "STATE_UPPER" || districtType === "STATE_LOWER") {
    return "State laws and budget";
  }
  if (districtType === "LOCAL_EXEC") {
    return "Local executive actions, city/county budget, appointments";
  }
  return "Local ordinances, zoning, city/county services";
}

async function main() {
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalLinked = 0;

  for (const zip of zips) {
    console.log(`\nFetching state/local officials for ZIP ${zip}...`);
    const officials = await fetchOfficials(zip);
    const relevant = officials.filter((o) => RELEVANT_DISTRICT_TYPES.has(o.office?.district?.district_type));

    console.log(`  Got ${officials.length} total officials, ${relevant.length} in scope (state/local).`);

    for (const official of relevant) {
      const name = [official.first_name, official.middle_initial, official.last_name].filter(Boolean).join(" ");
      const districtType = official.office.district.district_type;
      const externalId = `cicero-${official.sk}`;

      const { data: existing } = await supabase
        .from("representatives")
        .select("id")
        .eq("external_id", externalId)
        .maybeSingle();

      let repId: string;

      if (existing) {
        repId = existing.id;
        await supabase
          .from("representatives")
          .update({ name, photo_url: official.photo_origin_url ?? null })
          .eq("id", repId);
        totalUpdated++;
      } else {
        const { data: inserted, error } = await supabase
          .from("representatives")
          .insert({
            level: levelFor(districtType),
            role: official.office.title,
            controls: controlsFor(districtType),
            name,
            jurisdiction_confidence: "High",
            photo_url: official.photo_origin_url ?? null,
            external_id: externalId,
          })
          .select("id")
          .single();

        if (error) {
          console.error(`  Failed to insert ${name}:`, error.message);
          continue;
        }
        repId = inserted.id;
        totalInserted++;
        console.log(`  Inserted: ${name} — ${official.office.title} (${levelFor(districtType)})`);
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

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(
    `\nDone. ${totalInserted} new state/local officials inserted, ${totalUpdated} updated, ` +
    `${totalLinked} new ZIP-coverage links created.`
  );
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
