import { SupabaseClient } from "@supabase/supabase-js";
import { TopicScope } from "./types";

export interface ExploreSearchStory {
  id: string;
  headline: string;
  scope: TopicScope;
  topic: string;
}

export interface ExploreSearchResult {
  found: boolean;
  answer?: string;
  /** The stories the answer was built from, so the reader can open them. */
  stories?: ExploreSearchStory[];
  message?: string;
  error?: string;
}

/**
 * Calls the explore-search Edge Function — grounded synthesis over real,
 * ingested stories only. Used by both the search bar (free text) and the topic
 * chips (chip label passed as the query).
 *
 * State and topics are passed so results match what Today would consider local
 * to this reader, and so their chosen interests rank higher.
 */
export async function searchExplore(
  supabase: SupabaseClient,
  query: string,
  options: { state?: string | null; topics?: string[] } = {}
): Promise<ExploreSearchResult> {
  const { data, error } = await supabase.functions.invoke("explore-search", {
    body: { query, state: options.state ?? null, topics: options.topics ?? [] },
  });

  if (error) {
    return { found: false, error: error.message };
  }
  return data as ExploreSearchResult;
}
