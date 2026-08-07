import { SupabaseClient } from "@supabase/supabase-js";

export interface BillResult {
  congress: number;
  type: string;
  number: string;
  /** Display form, e.g. "H.R. 3684". */
  citation: string;
  title: string;
  sponsor: string | null;
  latestAction: string | null;
  latestActionDate: string | null;
  policyArea: string | null;
  url: string;
}

export interface BillSearchResult {
  bills: BillResult[];
  /** True when the query was a bill citation and went straight to the record. */
  matchedCitation: boolean;
  error?: string;
}

/**
 * Searches federal legislation via the bill-search Edge Function: govinfo for
 * full text, Congress.gov for the structured record. Independent of the story
 * corpus — this finds bills we have written nothing about.
 */
export async function searchBills(supabase: SupabaseClient, query: string): Promise<BillSearchResult> {
  const { data, error } = await supabase.functions.invoke("bill-search", { body: { query } });
  if (error) return { bills: [], matchedCitation: false, error: error.message };
  return data as BillSearchResult;
}
