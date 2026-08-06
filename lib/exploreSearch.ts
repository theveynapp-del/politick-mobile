import { SupabaseClient } from "@supabase/supabase-js";

export interface ExploreSearchResult {
  found: boolean;
  answer?: string;
  message?: string;
  sourceStoryIds?: string[];
  error?: string;
}

/**
 * Calls the explore-search Edge Function — grounded synthesis over real,
 * ingested stories only. Used by both the search bar (free text) and the
 * topic chips (chip label passed as the query, same underlying broad match
 * across headline/topic/what_happened/why_it_matters).
 */
export async function searchExplore(supabase: SupabaseClient, query: string): Promise<ExploreSearchResult> {
  const { data, error } = await supabase.functions.invoke("explore-search", {
    body: { query },
  });

  if (error) {
    return { found: false, error: error.message };
  }
  return data as ExploreSearchResult;
}
