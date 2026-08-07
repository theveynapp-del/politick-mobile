import { SupabaseClient } from "@supabase/supabase-js";
import { Story, Representative, TopicScope, RepLevel } from "./types";
import { stateForZip } from "./zipToState";
import { NO_ZIP_NOTE } from "./storyMeta";

/**
 * Data-access layer. Mirrors the shape of lib/mock-data.ts so the rest of
 * the app doesn't care whether it's reading mocks or Supabase.
 */

interface StoryRow {
  id: string;
  topic: string;
  scope: TopicScope;
  updated_at: string;
  headline: string;
  what_happened: string;
  why_it_matters: string;
  status: string;
  sponsor: string;
  cosponsors: string;
  next_checkpoint: string;
  fiscal_note: string;
  state: string | null;
  image_url: string | null;
  sources: { label: string; type: Story["sources"][number]["type"]; domain: string }[];
  story_zip_relevance: { zip: string; note: string }[];
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function mapStory(row: StoryRow, zip: string): Story {
  const zipNote = row.story_zip_relevance.find((z) => z.zip === zip)?.note ?? NO_ZIP_NOTE;

  return {
    id: row.id,
    topic: row.topic,
    scope: row.scope,
    updated: timeAgo(row.updated_at),
    headline: row.headline,
    whatHappened: row.what_happened,
    whyItMatters: row.why_it_matters,
    imageUrl: row.image_url,
    zipNote,
    storyMap: {
      status: row.status,
      sponsor: row.sponsor,
      cosponsors: row.cosponsors,
      nextCheckpoint: row.next_checkpoint,
      fiscalNote: row.fiscal_note,
    },
    sources: row.sources,
  };
}

export async function getTodayStories(
  supabase: SupabaseClient,
  zip: string
): Promise<Story[]> {
  const { data, error } = await supabase
    .from("stories")
    .select(
      `id, topic, scope, updated_at, headline, what_happened, why_it_matters,
       status, sponsor, cosponsors, next_checkpoint, fiscal_note, state, image_url,
       sources ( label, type, domain ),
       story_zip_relevance ( zip, note )`
    )
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("getTodayStories failed:", error.message);
    return [];
  }

  // Federal and World stories apply nationwide. Local and State stories only
  // exist for the states actually ingested, so they're filtered to the user's
  // own state — otherwise a Missouri user sees Montgomery County zoning news
  // labelled "Local", as if it were theirs.
  const userState = stateForZip(zip);
  const rows = (data as unknown as StoryRow[]).filter(
    (row) => row.scope === "Federal" || row.scope === "World" || row.state === userState
  );

  return rows.map((row) => mapStory(row, zip));
}

export interface ZipLocation {
  city: string;
  stateAbbr: string;
  county: string | null;
}

/**
 * Where a ZIP actually is. Populated by the representative lookup from
 * Cicero's geocode, so it only exists for ZIPs that have been resolved —
 * callers fall back to the state name the ZIP prefix gives.
 */
export async function getZipLocation(
  supabase: SupabaseClient,
  zip: string
): Promise<ZipLocation | null> {
  const { data, error } = await supabase
    .from("zip_locations")
    .select("city, state_abbr, county")
    .eq("zip", zip)
    .maybeSingle();

  if (error || !data) return null;
  return { city: data.city, stateAbbr: data.state_abbr, county: data.county };
}

interface RepRow {
  id: string;
  level: RepLevel;
  role: string;
  controls: string;
  name: string;
  jurisdiction_confidence: Representative["jurisdictionConfidence"];
  district: string | null;
  photo_url: string | null;
  phone: string | null;
  website: string | null;
}

// Officials arrive in arbitrary order, which would bury the Governor below
// backbench legislators. Rank by prominence within each level so the offices
// people look for first appear first.
const ROLE_RANK: Record<string, number> = {
  Governor: 0,
  "Lieutenant Governor": 1,
  "Attorney General": 2,
  "Secretary of State": 3,
  Comptroller: 4,
  Treasurer: 5,
  "US Senator": 10,
  "US House representative": 11,
  Mayor: 20,
  "County Executive": 21,
};

function rankFor(rep: Representative): number {
  return ROLE_RANK[rep.role] ?? 50;
}

// Generation of the lookup logic behind a ZIP's stored coverage. Must stay in
// sync with LOOKUP_VERSION in supabase/functions/lookup-representatives.
// Bumping it makes ZIPs resolved by an older generation re-resolve rather than
// serving a stale, narrower list — without this, every ZIP cached before
// governors were added would never have shown one.
const LOOKUP_VERSION = 2;

interface CoverageRow {
  source_version: number | null;
  representatives: RepRow;
}

async function fetchCoverage(
  supabase: SupabaseClient,
  zip: string
): Promise<{ reps: Representative[]; stale: boolean }> {
  const { data, error } = await supabase
    .from("rep_zip_coverage")
    .select("source_version, representatives ( id, level, role, controls, name, jurisdiction_confidence, district, photo_url, phone, website )")
    .eq("zip", zip);

  if (error) {
    console.error("getRepresentativesByZip failed:", error.message);
    return { reps: [], stale: false };
  }

  const rows = (data ?? []) as unknown as CoverageRow[];
  const stale = rows.length > 0 && rows.some((r) => (r.source_version ?? 1) < LOOKUP_VERSION);

  return { reps: mapReps(rows), stale };
}

function mapReps(rows: { representatives: RepRow }[]): Representative[] {
  return rows
    .map((row) => ({
      id: row.representatives.id,
      level: row.representatives.level,
      role: row.representatives.role,
      controls: row.representatives.controls,
      name: row.representatives.name,
      jurisdictionConfidence: row.representatives.jurisdiction_confidence,
      district: row.representatives.district,
      photoUrl: row.representatives.photo_url,
      phone: row.representatives.phone,
      website: row.representatives.website,
    }))
    .sort((a, b) => rankFor(a) - rankFor(b) || a.name.localeCompare(b.name));
}

export async function getRepresentativesByZip(
  supabase: SupabaseClient,
  zip: string
): Promise<Representative[]> {
  const cached = await fetchCoverage(supabase, zip);

  // Serve stored coverage only when it came from the current generation of the
  // lookup. Anything older is re-resolved so newly-added offices (governors and
  // statewide executives) appear for ZIPs that were cached before them.
  if (cached.reps.length > 0 && !cached.stale) return cached.reps;

  // Nothing stored for this ZIP yet, or what's stored is out of date. Without
  // this the app only ever resolved the handful of ZIPs that had been
  // pre-seeded, and every other real US ZIP showed "no representative data".
  // The edge function fetches live from 5 Calls + Cicero and persists,
  // keeping those API keys server-side.
  const { error } = await supabase.functions.invoke("lookup-representatives", { body: { zip } });
  if (error) {
    console.error("lookup-representatives failed:", error.message);
    // Stale results still beat an empty screen.
    return cached.reps;
  }

  const refreshed = await fetchCoverage(supabase, zip);
  return refreshed.reps.length > 0 ? refreshed.reps : cached.reps;
}
