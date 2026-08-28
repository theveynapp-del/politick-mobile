import { SupabaseClient } from "@supabase/supabase-js";

/**
 * How a member of Congress actually voted.
 *
 * Sponsorship (lib/govActivity.ts) says what a member put their name to.
 * This says how they came down on everything else, which is the far larger
 * record and the one that shows a position rather than an intention.
 *
 * Read from our own tables rather than fetched live: a roll call carries every
 * member of the chamber, so answering this from the source would mean pulling
 * ~430 member records per vote, per reader.
 */

export interface MemberVote {
  rollCallId: string;
  chamber: "House" | "Senate";
  /** The official question, verbatim from the chamber. */
  question: string;
  /** Plain-language rephrasing of the question. Null until the ingest fills it. */
  plainSummary: string | null;
  billCitation: string | null;
  billUrl: string | null;
  /** The chamber's outcome — not this member's position. */
  result: string | null;
  votedAt: string;
  sourceUrl: string;
  /** This member's position: Yea, Nay, Present, Not Voting. */
  voteCast: string;
}

interface Row {
  vote_cast: string;
  roll_calls: {
    id: string;
    chamber: "House" | "Senate";
    question: string;
    plain_summary: string | null;
    bill_citation: string | null;
    bill_url: string | null;
    result: string | null;
    voted_at: string;
    source_url: string;
  } | null;
}

export async function getMemberVotes(
  supabase: SupabaseClient,
  bioguideId: string,
  limit = 12
): Promise<MemberVote[]> {
  const { data, error } = await supabase
    .from("member_votes")
    .select(
      "vote_cast, roll_calls!inner(id, chamber, question, plain_summary, bill_citation, bill_url, result, voted_at, source_url)"
    )
    .eq("bioguide_id", bioguideId)
    .order("voted_at", { referencedTable: "roll_calls", ascending: false })
    .limit(limit);

  if (error) {
    console.error("member votes failed:", error.message);
    return [];
  }

  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.roll_calls)
    .map((r) => {
      const rc = r.roll_calls!;
      return {
        rollCallId: rc.id,
        chamber: rc.chamber,
        question: rc.question,
        plainSummary: rc.plain_summary,
        billCitation: rc.bill_citation,
        billUrl: rc.bill_url,
        result: rc.result,
        votedAt: rc.voted_at,
        sourceUrl: rc.source_url,
        voteCast: r.vote_cast,
      };
    })
    .sort((a, b) => b.votedAt.localeCompare(a.votedAt));
}

/**
 * Colour-independent grouping for a position.
 *
 * Deliberately not mapped to party colours or to approval — "yes" is not good
 * and "no" is not bad. The app only ever says which way the vote went.
 */
export type VoteStance = "yes" | "no" | "abstain";

export function stanceOf(voteCast: string): VoteStance {
  const v = voteCast.trim().toLowerCase();
  if (v === "yea" || v === "aye" || v === "yes") return "yes";
  if (v === "nay" || v === "no") return "no";
  return "abstain";
}

/** The reader-facing label for a position. */
export function stanceLabel(voteCast: string): string {
  switch (stanceOf(voteCast)) {
    case "yes":
      return "Voted yes";
    case "no":
      return "Voted no";
    default:
      // "Present" and "Not Voting" are meaningfully different from each other
      // and from a missed vote, so the record's own word is kept.
      return voteCast;
  }
}
