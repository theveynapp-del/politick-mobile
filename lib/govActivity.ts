import { SupabaseClient } from "@supabase/supabase-js";

export type RelationshipType = "sponsored" | "cosponsored";

export interface GovActivityItem {
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

/**
 * Legislation the reader's own members of Congress sponsored or cosponsored,
 * from the official record. Every field here comes from Congress.gov — nothing
 * about the relationship is inferred.
 */
export async function getGovActivity(
  supabase: SupabaseClient,
  bioguideIds: string[]
): Promise<GovActivityItem[]> {
  if (bioguideIds.length === 0) return [];
  const { data, error } = await supabase.functions.invoke("gov-activity", { body: { bioguideIds } });
  if (error) {
    console.error("gov-activity failed:", error.message);
    return [];
  }
  return (data?.activity ?? []) as GovActivityItem[];
}

/** Bioguide IDs look like "R000606". Cicero's ids don't, which is the filter. */
export function bioguideIdsFor(reps: { level: string; externalId: string | null }[]): string[] {
  return reps
    .filter((r) => r.level === "Federal" && r.externalId && /^[A-Z]\d{6}$/.test(r.externalId))
    .map((r) => r.externalId as string);
}
