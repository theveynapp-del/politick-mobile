import { SupabaseClient } from "@supabase/supabase-js";
import { Story, Representative, TopicScope, RepLevel } from "./types";
import { stateForZip } from "./zipToState";

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
  const zipNote =
    row.story_zip_relevance.find((z) => z.zip === zip)?.note ??
    "We don't have local relevance for this zip code yet.";

  return {
    id: row.id,
    topic: row.topic,
    scope: row.scope,
    updated: timeAgo(row.updated_at),
    headline: row.headline,
    whatHappened: row.what_happened,
    whyItMatters: row.why_it_matters,
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
       status, sponsor, cosponsors, next_checkpoint, fiscal_note, state,
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

interface RepRow {
  id: string;
  level: RepLevel;
  role: string;
  controls: string;
  name: string;
  jurisdiction_confidence: Representative["jurisdictionConfidence"];
  photo_url: string | null;
  phone: string | null;
  website: string | null;
}

async function fetchRepsFromDb(supabase: SupabaseClient, zip: string): Promise<Representative[]> {
  const { data, error } = await supabase
    .from("rep_zip_coverage")
    .select("representatives ( id, level, role, controls, name, jurisdiction_confidence, photo_url, phone, website )")
    .eq("zip", zip);

  if (error) {
    console.error("getRepresentativesByZip failed:", error.message);
    return [];
  }

  return (data as unknown as { representatives: RepRow }[]).map((row) => ({
    id: row.representatives.id,
    level: row.representatives.level,
    role: row.representatives.role,
    controls: row.representatives.controls,
    name: row.representatives.name,
    jurisdictionConfidence: row.representatives.jurisdiction_confidence,
    photoUrl: row.representatives.photo_url,
    phone: row.representatives.phone,
    website: row.representatives.website,
  }));
}

export async function getRepresentativesByZip(
  supabase: SupabaseClient,
  zip: string
): Promise<Representative[]> {
  const cached = await fetchRepsFromDb(supabase, zip);
  if (cached.length > 0) return cached;

  // Nothing stored for this ZIP yet. Without this the app only ever resolved
  // the handful of ZIPs that had been pre-seeded, and every other real US ZIP
  // showed "no representative data". The edge function fetches live from
  // 5 Calls + Cicero and persists, keeping those API keys server-side.
  const { error } = await supabase.functions.invoke("lookup-representatives", { body: { zip } });
  if (error) {
    console.error("lookup-representatives failed:", error.message);
    return [];
  }

  return fetchRepsFromDb(supabase, zip);
}
