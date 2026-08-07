import { SupabaseClient } from "@supabase/supabase-js";

export interface DefinitionResult {
  found: boolean;
  term: string;
  definition?: string;
  error?: string;
}

/**
 * A plain-language definition for a civic term the app has no coverage of.
 *
 * Only called when lib/jargon has no reviewed entry, since that library is
 * free, instant and hand-checked. Returns found:false for anything that isn't
 * a civic concept, so the caller shows nothing rather than a guess.
 */
export async function defineTerm(supabase: SupabaseClient, query: string): Promise<DefinitionResult> {
  const { data, error } = await supabase.functions.invoke("define-term", { body: { query } });
  if (error) return { found: false, term: query, error: error.message };
  return data as DefinitionResult;
}
