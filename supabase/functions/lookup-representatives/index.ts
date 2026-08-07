// On-demand representative lookup for ZIPs that haven't been synced yet.
// Pulls from 5 Calls (federal) and Cicero (state + local), scoped to a single
// ZIP and run live from the client, so any real US ZIP resolves rather than
// only the handful pre-seeded in the database.
//
// Deploy:  supabase functions deploy lookup-representatives --no-verify-jwt
// Secrets: FIVE_CALLS_TOKEN, CICERO_API_KEY (SUPABASE_* are injected)
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIVE_CALLS_TOKEN = Deno.env.get("FIVE_CALLS_TOKEN");
const CICERO_API_KEY = Deno.env.get("CICERO_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Generation of this lookup's logic. Bump whenever the set of officials
// returned changes, so ZIPs resolved by an older generation re-resolve
// instead of serving a stale, narrower list forever. Must stay in sync with
// LOOKUP_VERSION in lib/queries.ts.
//   1 -> federal + state legislature + local
//   2 -> adds governors and statewide elected executives
const LOOKUP_VERSION = 2;

const AREA_MAP: Record<string, { level: "Federal" | "State"; role: string; controls: string }> = {
  "US House": { level: "Federal", role: "US House representative", controls: "Federal laws and spending" },
  "US Senate": { level: "Federal", role: "US Senator", controls: "Senate votes and confirmations" },
  Governor: { level: "State", role: "Governor", controls: "State executive actions, state budget signing, appointments" },
  SecState: { level: "State", role: "Secretary of State", controls: "State elections administration, official records" },
  AttorneysGeneral: { level: "State", role: "Attorney General", controls: "State legal enforcement, consumer protection" },
};

// STATE_EXEC is included so the Governor actually appears — 5 Calls does not
// return governors in practice, so Cicero is the only source for them.
const RELEVANT_DISTRICT_TYPES = new Set([
  "STATE_EXEC",
  "STATE_UPPER",
  "STATE_LOWER",
  "LOCAL",
  "LOCAL_EXEC",
]);

// Cicero returns ~13 STATE_EXEC entries per ZIP, mostly appointed agency heads
// (Secretary of Agriculture, Public Service Commissioners, Insurance
// Commissioner…). Those don't represent anyone, so only statewide offices that
// are elected in most states are kept. Matched exactly, so "Governor" doesn't
// also admit "Lieutenant Governor" by accident — that one is listed on purpose.
// NATIONAL_EXEC is deliberately absent: federal cabinet secretaries are
// appointed, nationwide, and not constituent representatives.
const STATE_EXEC_TITLES = new Set([
  "Governor",
  "Lieutenant Governor",
  "Attorney General",
  "Secretary of State",
  "Comptroller",
  "Treasurer",
]);

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  PR: "Puerto Rico",
};

// Every outbound check is time-boxed. Some government hosts accept the
// connection and then never respond, which without a deadline stalls the
// whole request — one ZIP took over two minutes before this was added.
const PROBE_TIMEOUT_MS = 3000;

/**
 * Cicero's portrait links go stale (the Maryland governor's 404s). Probes with
 * a one-byte ranged GET rather than HEAD: some government hosts answer HEAD
 * with 200 but then 403 the actual image fetch (mass.gov does), which would
 * otherwise store a link that never renders.
 */
async function imageLoads(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { Range: "bytes=0-0", "User-Agent": "Mozilla/5.0 (compatible; PolitickApp/1.0)" },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return res.ok && (res.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}

/**
 * Official portraits from Wikipedia, used only when the source link is dead.
 * A bare name can hit a disambiguation page or the wrong person entirely, so
 * the article must actually mention this office and state before it's trusted;
 * showing the wrong person's face is far worse than showing initials.
 */
async function wikipediaPortrait(name: string, stateName: string, title: string): Promise<string | null> {
  // Common names land on disambiguation pages — "Bill Lee" needs the
  // state-qualified title before it resolves to the Tennessee governor.
  const candidates = [name, `${name} (politician)`];
  if (stateName) candidates.push(`${name} (${stateName} politician)`);

  for (const candidate of candidates) {
    try {
      const slug = encodeURIComponent(candidate.replace(/ /g, "_"));
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`, {
        headers: { "User-Agent": "PolitickApp/1.0 (civic information app)" },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const data = await res.json();

      if (data.type === "disambiguation") continue;
      const blurb = `${data.description ?? ""} ${data.extract ?? ""}`.toLowerCase();
      if (blurb.includes("may refer to")) continue;

      const mentionsState = stateName ? blurb.includes(stateName.toLowerCase()) : false;
      const mentionsOffice = title ? blurb.includes(title.toLowerCase()) : false;
      if (!mentionsState || !mentionsOffice) continue;

      const thumb = data.thumbnail?.source ?? null;
      if (thumb) return thumb;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

async function resolvePortrait(
  ciceroUrl: string | null,
  name: string,
  stateName: string,
  title: string
): Promise<string | null> {
  if (ciceroUrl && (await imageLoads(ciceroUrl))) return ciceroUrl;
  return await wikipediaPortrait(name, stateName, title);
}

async function upsertRep(
  externalId: string,
  fields: {
    level: string;
    role: string;
    controls: string;
    name: string;
    jurisdiction_confidence: string;
    photo_url: string | null;
    phone: string | null;
    website: string | null;
  },
  zip: string
) {
  const { data: existing } = await supabase
    .from("representatives")
    .select("id")
    .eq("external_id", externalId)
    .maybeSingle();

  let repId: string;
  if (existing) {
    repId = existing.id;
    await supabase.from("representatives").update(fields).eq("id", repId);
  } else {
    const { data: inserted, error } = await supabase
      .from("representatives")
      .insert({ ...fields, external_id: externalId })
      .select("id")
      .single();
    if (error || !inserted) return;
    repId = inserted.id;
  }

  const { data: existingLink } = await supabase
    .from("rep_zip_coverage")
    .select("zip")
    .eq("zip", zip)
    .eq("representative_id", repId)
    .maybeSingle();

  if (existingLink) {
    // Re-stamp so a ZIP first resolved by an older generation counts as
    // current once it has been re-run.
    await supabase
      .from("rep_zip_coverage")
      .update({ source_version: LOOKUP_VERSION })
      .eq("zip", zip)
      .eq("representative_id", repId);
  } else {
    await supabase
      .from("rep_zip_coverage")
      .insert({ zip, representative_id: repId, source_version: LOOKUP_VERSION });
  }
}

async function syncFiveCalls(zip: string) {
  if (!FIVE_CALLS_TOKEN) return;
  const res = await fetch(`https://api.5calls.org/v1/representatives?location=${zip}`, {
    headers: { "X-5Calls-Token": FIVE_CALLS_TOKEN },
  });
  if (!res.ok) return;
  const data = await res.json();
  if (data.error || !Array.isArray(data.representatives)) return;

  for (const rep of data.representatives) {
    const mapping = AREA_MAP[rep.area];
    if (!mapping) continue;
    await upsertRep(
      rep.id,
      {
        level: mapping.level,
        role: mapping.role,
        controls: mapping.controls,
        name: rep.name,
        jurisdiction_confidence: data.lowAccuracy ? "Needs review" : "High",
        photo_url: rep.photoURL ?? null,
        phone: rep.phone ?? null,
        website: rep.url ?? null,
      },
      zip
    );
  }
}

function levelFor(districtType: string): "State" | "Local" {
  return districtType.startsWith("STATE") ? "State" : "Local";
}

function controlsFor(districtType: string, title: string): string {
  if (districtType === "STATE_EXEC") {
    if (title === "Governor") return "State executive actions, state budget signing, appointments";
    if (title === "Attorney General") return "State legal enforcement, consumer protection";
    if (title === "Secretary of State") return "State elections administration, official records";
    return "Statewide executive office";
  }
  if (districtType === "STATE_UPPER" || districtType === "STATE_LOWER") return "State laws and budget";
  if (districtType === "LOCAL_EXEC") return "Local executive actions, city/county budget, appointments";
  return "Local ordinances, zoning, city/county services";
}

async function syncCicero(zip: string) {
  if (!CICERO_API_KEY) return;
  const url = `https://app.cicerodata.com/v3.1/official?search_postal=${zip}&search_country=US&format=json&key=${CICERO_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return;
  const data = await res.json();
  if (data.response?.errors?.length) return;

  const candidate = data.response?.results?.candidates?.[0];
  const officials = data.response?.results?.officials ?? candidate?.officials ?? [];

  // The geocode candidate names the place this ZIP actually is. Persisted so
  // the app can show "Bethesda, MD" rather than just the state, which is all
  // the ZIP-prefix table can tell it.
  if (candidate?.match_city && candidate?.match_region) {
    await supabase.from("zip_locations").upsert(
      {
        zip,
        city: candidate.match_city,
        state_abbr: candidate.match_region,
        county: candidate.match_subregion ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "zip" }
    );
  }

  const relevant = officials.filter((official: any) => {
    const districtType = official.office?.district?.district_type;
    if (!RELEVANT_DISTRICT_TYPES.has(districtType)) return false;
    if (districtType === "STATE_EXEC" && !STATE_EXEC_TITLES.has(official.office?.title ?? "")) return false;
    return true;
  });

  // Portrait repair is limited to statewide executives: they're the most
  // visible rows, they're where the dead links actually showed up, and it
  // keeps the added network round-trips bounded. Legislators and local
  // officials keep whatever Cicero gives and fall back to initials in the UI.
  // Resolved in parallel — done sequentially these probes stack into a
  // multi-minute request.
  const portraits = await Promise.all(
    relevant.map(async (official: any) => {
      const districtType = official.office?.district?.district_type;
      const raw = official.photo_origin_url ?? null;
      if (districtType !== "STATE_EXEC") return raw;
      const name = [official.first_name, official.middle_initial, official.last_name].filter(Boolean).join(" ");
      const abbr = official.office?.district?.state ?? official.office?.representing_state ?? "";
      return await resolvePortrait(raw, name, STATE_NAMES[abbr] ?? "", official.office?.title ?? "");
    })
  );

  for (let i = 0; i < relevant.length; i++) {
    const official = relevant[i];
    const districtType = official.office.district.district_type;
    const title = official.office?.title ?? "";
    const name = [official.first_name, official.middle_initial, official.last_name].filter(Boolean).join(" ");

    await upsertRep(
      `cicero-${official.sk}`,
      {
        level: levelFor(districtType),
        role: title,
        controls: controlsFor(districtType, title),
        name,
        jurisdiction_confidence: "High",
        photo_url: portraits[i],
        phone: official.addresses?.[0]?.phone_1 ?? null,
        website: official.urls?.[0] ?? null,
      },
      zip
    );
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    let zip = url.searchParams.get("zip");
    if (!zip && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      zip = body.zip ?? null;
    }

    if (!zip || !/^\d{5}$/.test(zip)) {
      return new Response(JSON.stringify({ error: "A 5-digit zip is required." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    await Promise.all([syncFiveCalls(zip), syncCicero(zip)]);

    return new Response(JSON.stringify({ ok: true, zip }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
