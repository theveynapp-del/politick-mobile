import { Representative } from "./types";

/**
 * What the reader is voting for, and nothing beyond that.
 *
 * Everything here is either constitutional structure or a sourced list. There
 * are deliberately no candidates: Rotunda has no entitled ballot source yet,
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

/**
 * States holding a 2026 Senate SPECIAL election, on top of the Class II cycle.
 *
 * Ohio and Florida are filling seats vacated mid-term — JD Vance's and Marco
 * Rubio's. Neither state holds a Class II seat, so keying the ballot on class
 * alone told voters in both states they had no Senate race when they do. That
 * is the precise harm this module is meant to prevent: a stated absence reads
 * as "nothing here", which is a claim, not a silence.
 *
 * 35 seats are contested in 2026 — 33 Class II plus these two.
 */
export const SPECIAL_SENATE_2026 = new Set(["OH", "FL"]);

export interface BallotOffice {
  office: string;
  /** The seat itself, e.g. "MD-08" or "Maryland". */
  seat: string;
  /** What this office actually decides — the reason to care about the vote. */
  controls: string;
  /** Whoever currently holds it, when we can resolve them. */
  incumbent: Representative | null;
  incumbentNote: string;
  /**
   * What the reader is physically deciding when they reach this line on the
   * paper — how many to pick, for how long, and what it appears under.
   *
   * Written here rather than generated. A model could phrase it, but the term
   * length and the number of seats are facts about the office, and inventing
   * either would mislead someone standing in a booth.
   */
  plainVote: string;
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
    plainVote:
      "Pick one person to represent your district in the U.S. House for the next two years. Only people in your district vote in this race.",
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
      plainVote:
        "Pick one person to represent your whole state in the U.S. Senate for the next six years. Everyone in your state votes in this race.",
    });
  } else if (stateAbbr && SPECIAL_SENATE_2026.has(stateAbbr)) {
    out.push({
      office: "U.S. Senate (special election)",
      seat: stateName ?? stateAbbr,
      controls:
        "Senate votes, confirmations and treaties. Your state is filling a seat that was vacated mid-term, so this race is on the ballot outside the usual six-year cycle.",
      incumbent: null,
      incumbentNote: "A vacated Senate seat is on the ballot",
      plainVote:
        "Pick one person to finish out a Senate term that was left unfinished. It may appear lower down the ballot than the regular races, and it is easy to miss.",
    });
  }

  return out;
}

/**
 * What actually happens in the booth.
 *
 * The overwhelm at a polling place is rarely about the headline race — it's
 * the twelve lines below it nobody warned you about, and not knowing which
 * rules you're allowed to bend. All of this is settled procedure that holds in
 * every state, so it can be stated plainly without a per-jurisdiction source.
 * Anything that genuinely varies by state is deferred to the election office
 * rather than guessed at.
 */
export interface BoothNote {
  title: string;
  body: string;
}

export const BOOTH_NOTES: BoothNote[] = [
  {
    title: "You can skip anything you're unsure about",
    body: "Leaving a race blank does not void your ballot. Every other choice on it still counts. Guessing on a race you know nothing about is not more civic than skipping it.",
  },
  {
    title: "The ballot is usually longer than you expect",
    body: "Judges, school boards, ballot questions and special elections sit below the races that get the news coverage. Check whether your ballot continues on the back — plenty of people miss half of it.",
  },
  {
    title: "You can ask for a fresh ballot",
    body: "If you mark the wrong box, hand it back and ask for a replacement. Poll workers do this all day and you are entitled to it. Don't try to scribble out a mistake.",
  },
  {
    title: "Poll workers can help — and can't influence you",
    body: "They can explain how the machine works, how to fix an error, and how many candidates a race allows. They are not permitted to tell you who to vote for, so asking is safe.",
  },
  {
    title: "Some races have no party listed",
    body: "Judicial and many local races are nonpartisan, so no letter appears next to the name. That's the design, not an omission — those offices are meant to be decided on the person.",
  },
  {
    title: "\"Retention\" questions are yes-or-no",
    body: "Some judges appear as \"Shall Judge X be retained?\" with no opponent. You're voting on whether they keep the seat, not choosing between people.",
  },
  {
    title: "If your name isn't on the roll, ask for a provisional ballot",
    body: "You are allowed to cast one, and it is counted once your eligibility is confirmed. Don't leave without voting — that is the one outcome that can't be fixed afterwards.",
  },
];

/**
 * Ballot words that stop people cold, in the language they'd use themselves.
 *
 * Deliberately separate from lib/jargon.ts, which decodes legislative
 * procedure inside a bill's history. These are the terms printed on the paper
 * in front of a voter.
 */
export const BALLOT_TERMS: { term: string; plain: string }[] = [
  {
    term: "Ballot measure / proposition",
    plain: "A yes-or-no question about a law or a change to your state constitution. You're voting on the policy itself, not on a person.",
  },
  {
    term: "Bond question",
    plain: "Permission for a government to borrow money for something specific — a school, a road, a hospital. Yes means it can borrow and repay it, usually through taxes.",
  },
  {
    term: "Nonpartisan race",
    plain: "No party label is printed next to the candidates. Common for judges, school boards and many city offices.",
  },
  {
    term: "Retention",
    plain: "A yes-or-no vote on whether a sitting judge keeps their seat. There is no opponent.",
  },
  {
    term: "Vote for no more than N",
    plain: "The race fills several seats at once. You may pick up to that many different people — not the same person more than once.",
  },
  {
    term: "Write-in",
    plain: "A blank line to name someone not printed on the ballot. In most states only registered write-in candidates get counted.",
  },
  {
    term: "Provisional ballot",
    plain: "A ballot cast when there's a question about your registration. It's set aside and counted once officials confirm you were eligible.",
  },
  {
    term: "Straight-ticket voting",
    plain: "One mark that votes for every candidate of a single party. Most states have removed it, and where it exists it usually skips nonpartisan races.",
  },
];

/**
 * Whether we can say anything at all about this reader's ballot. False keeps
 * the module in its fail-closed state rather than showing an empty shell.
 */
export function hasBallotInfo(stateAbbr: string | null): boolean {
  return !!stateAbbr;
}
