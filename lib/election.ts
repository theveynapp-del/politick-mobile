import { Representative } from "./types";

/**
 * What the reader is voting for, and nothing beyond that.
 *
 * Everything here is either constitutional structure or a sourced list. There
 * are deliberately no candidates: Politick has no entitled ballot source yet,
 * and a partial candidate list is worse than none — a voter who trusts an
 * incomplete ballot is harmed more than one who was told we don't have it.
 */

/** First Tuesday after the first Monday in November. */
export const ELECTION_DAY_2026 = new Date("2026-11-03T00:00:00");
export const CYCLE_YEAR = "2026";

/**
 * States with a Class II Senate seat, which is the class contested in 2026.
 *
 * Taken from senate.gov's senators_cfm.xml, which publishes the class of all
 * 100 sitting senators, and checked against the constitutional 33/33/34 split.
 * Written down rather than fetched live because Senate classes are fixed —
 * they only change if a state gains a seat.
 */
export const CLASS_II_STATES = new Set([
  "AK", "AL", "AR", "CO", "DE", "GA", "IA", "ID", "IL", "KS", "KY", "LA",
  "MA", "ME", "MI", "MN", "MS", "MT", "NC", "NE", "NH", "NJ", "NM", "OK",
  "OR", "RI", "SC", "SD", "TN", "TX", "VA", "WV", "WY",
]);

export interface BallotOffice {
  office: string;
  /** The seat itself, e.g. "MD-08" or "Maryland". */
  seat: string;
  /** What this office actually decides — the reason to care about the vote. */
  controls: string;
  /** Whoever currently holds it, when we can resolve them. */
  incumbent: Representative | null;
  incumbentNote: string;
}

export function daysUntilElection(from: Date = new Date()): number {
  return Math.max(0, Math.ceil((ELECTION_DAY_2026.getTime() - from.getTime()) / 86400000));
}

/**
 * The federal offices on this reader's ballot.
 *
 * The House is unconditional — all 435 seats are contested every two years.
 * The Senate depends on whether the state holds a Class II seat. Governors and
 * state or local offices are absent because we have no sourced schedule for
 * them; claiming a race that isn't happening is the failure to avoid.
 */
export function federalBallot(
  stateAbbr: string | null,
  stateName: string | null,
  reps: Representative[]
): BallotOffice[] {
  const out: BallotOffice[] = [];
  const house = reps.find((r) => r.role === "US House representative") ?? null;

  out.push({
    office: "U.S. House of Representatives",
    seat: house?.district ?? (stateName ? `${stateName} — your district` : "Your district"),
    controls: "Federal laws and spending. Every seat is contested every two years.",
    incumbent: house,
    incumbentNote: house ? "Currently held by" : "We couldn't resolve your representative",
  });

  if (stateAbbr && CLASS_II_STATES.has(stateAbbr)) {
    // Both senators are stored; the one up for election is the Class II
    // holder, which we can't distinguish per-person from our own data, so the
    // seat is named without asserting which sitting senator it belongs to.
    out.push({
      office: "U.S. Senate",
      seat: stateName ?? stateAbbr,
      controls: "Senate votes, confirmations and treaties. One of your state's two seats is contested this year.",
      incumbent: null,
      incumbentNote: "One of your state's two Senate seats is on the ballot",
    });
  }

  return out;
}

/**
 * Whether we can say anything at all about this reader's ballot. False keeps
 * the module in its fail-closed state rather than showing an empty shell.
 */
export function hasBallotInfo(stateAbbr: string | null): boolean {
  return !!stateAbbr;
}
