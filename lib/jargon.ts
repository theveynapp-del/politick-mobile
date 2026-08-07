/**
 * Procedural term decoder.
 *
 * These are definitions of legislative mechanics, not characterisations of
 * politics — what a committee referral *is*, not whether it was a good idea.
 * They're written here rather than generated so the wording is reviewable and
 * stable; the generative layer is only ever used to explain, never to define.
 *
 * Reference: the House and Senate glossaries at congress.gov/help/legislative-glossary
 */
export interface JargonTerm {
  term: string;
  /** One sentence, plain language. */
  shortDefinition: string;
  expandedDefinition: string;
  category: "Legislative process" | "Voting" | "Committees" | "Spending" | "Executive" | "Elections";
  relatedTerms: string[];
  /**
   * How the term actually appears in official text. Needed because the record
   * rarely uses the canonical phrase — a referral reads "Referred to the
   * Committee on Banking, Housing, and Urban Affairs", which no literal match
   * on "referred to committee" would ever find.
   */
  pattern: RegExp;
}

export const JARGON: JargonTerm[] = [
  {
    term: "referred to committee",
    pattern: /\breferred to\b/i,
    shortDefinition: "The bill has been sent to a smaller group of lawmakers for detailed review.",
    expandedDefinition:
      "Nearly every bill is assigned to at least one committee that specializes in its subject. The committee decides whether to examine it further. Most bills never move past this point — not because they were rejected in a vote, but because the committee simply never takes them up.",
    category: "Committees",
    relatedTerms: ["markup", "hearing", "reported by"],
  },
  {
    term: "markup",
    pattern: /\bmark ?-?up\b/i,
    shortDefinition: "The meeting where a committee goes through a bill line by line and can change it.",
    expandedDefinition:
      "During a markup, committee members debate the text, offer amendments, and vote on whether to send the bill to the full chamber. The version that emerges can look quite different from the one introduced.",
    category: "Committees",
    relatedTerms: ["referred to committee", "reported by", "amendment"],
  },
  {
    term: "reported by",
    pattern: /\breported (by|to)\b|ordered to be reported/i,
    shortDefinition: "The committee has finished with the bill and sent it to the full chamber.",
    expandedDefinition:
      "Being reported out means the committee voted to advance the bill. It usually comes with a written report explaining what the bill does. This is a necessary step before most floor votes, though it does not guarantee one is scheduled.",
    category: "Committees",
    relatedTerms: ["markup", "calendar"],
  },
  {
    term: "calendar",
    pattern: /placed on .{0,60}calendar/i,
    shortDefinition: "A list of bills eligible for floor consideration — not a schedule of dates.",
    expandedDefinition:
      "Placing a bill on the calendar makes it available to be brought up. It does not mean a vote has been scheduled. Leadership decides what actually reaches the floor and when, and many calendared bills are never called up.",
    category: "Legislative process",
    relatedTerms: ["reported by", "cloture"],
  },
  {
    term: "cloture",
    pattern: /\bcloture\b/i,
    shortDefinition: "A Senate vote to end debate on something, so it can move to a final vote.",
    expandedDefinition:
      "Senate debate is normally unlimited. Cloture is the procedure for cutting it off, and it usually needs 60 of 100 senators. Because of that threshold, cloture is often the point at which a measure with majority support still stops.",
    category: "Voting",
    relatedTerms: ["filibuster", "roll-call vote"],
  },
  {
    term: "filibuster",
    pattern: /\bfilibuster\b/i,
    shortDefinition: "Extending Senate debate to delay or prevent a vote.",
    expandedDefinition:
      "Because the Senate does not limit debate by default, a senator or group can keep a measure from reaching a vote. Ending one requires cloture. In practice this is usually procedural rather than a continuous speech.",
    category: "Voting",
    relatedTerms: ["cloture"],
  },
  {
    term: "roll-call vote",
    pattern: /roll ?-?call/i,
    shortDefinition: "A recorded vote where each member's individual position is published.",
    expandedDefinition:
      "In a roll-call vote every member is recorded as yea, nay, present, or not voting, and the result is part of the public record. This is how you can see how your own representative voted rather than only the outcome.",
    category: "Voting",
    relatedTerms: ["voice vote", "quorum"],
  },
  {
    term: "voice vote",
    pattern: /voice vote/i,
    shortDefinition: "A vote decided by who sounds louder, with no individual positions recorded.",
    expandedDefinition:
      "Members call out aye or no together and the chair judges the result. Because nothing is recorded, there is no way to know afterwards how any particular member voted. Routine or uncontested items are often handled this way.",
    category: "Voting",
    relatedTerms: ["roll-call vote"],
  },
  {
    term: "motion to recommit",
    pattern: /motion to recommit/i,
    shortDefinition: "A last attempt to send a bill back to committee before the final vote.",
    expandedDefinition:
      "Offered by the minority just before final passage, it is the last procedural chance to change or stop a bill on the floor. It rarely succeeds.",
    category: "Legislative process",
    relatedTerms: ["referred to committee"],
  },
  {
    term: "conference committee",
    pattern: /conference (committee|report)/i,
    shortDefinition: "A temporary joint group that reconciles the House and Senate versions of a bill.",
    expandedDefinition:
      "When both chambers pass different versions of the same bill, negotiators from each work out a single text. Both chambers must then pass that combined version without further changes.",
    category: "Committees",
    relatedTerms: ["referred to committee"],
  },
  {
    term: "continuing resolution",
    pattern: /continuing resolution/i,
    shortDefinition: "A short-term measure that keeps the government funded at existing levels.",
    expandedDefinition:
      "When Congress has not passed full spending bills by the deadline, a continuing resolution extends current funding for a set period. It buys time; it does not settle what the spending levels should be.",
    category: "Spending",
    relatedTerms: ["appropriation", "authorization"],
  },
  {
    term: "appropriation",
    pattern: /\bappropriat\w*/i,
    shortDefinition: "A law that actually provides money for a program.",
    expandedDefinition:
      "Appropriations supply the funds. This is distinct from authorization, which creates a program and sets a spending ceiling. A program can be authorised and still receive no money.",
    category: "Spending",
    relatedTerms: ["authorization", "continuing resolution"],
  },
  {
    term: "authorization",
    pattern: /\bauthoriz\w*/i,
    shortDefinition: "A law that creates or continues a program and sets a spending limit.",
    expandedDefinition:
      "Authorization establishes what may exist and up to how much. Money still has to arrive through a separate appropriation, which is why authorised programs are sometimes unfunded.",
    category: "Spending",
    relatedTerms: ["appropriation"],
  },
  {
    term: "veto",
    pattern: /\bveto(ed)?\b/i,
    shortDefinition: "The President's rejection of a bill passed by Congress.",
    expandedDefinition:
      "A vetoed bill returns to Congress, which can enact it anyway by a two-thirds vote in both chambers. That threshold is high, so most vetoes stand.",
    category: "Executive",
    relatedTerms: ["override"],
  },
  {
    term: "override",
    pattern: /\boverride\b/i,
    shortDefinition: "Congress enacting a bill despite the President's veto.",
    expandedDefinition:
      "Requires a two-thirds vote in both the House and the Senate. Because that is far above a simple majority, overrides are uncommon.",
    category: "Executive",
    relatedTerms: ["veto"],
  },
  {
    term: "executive order",
    pattern: /executive order/i,
    shortDefinition: "A directive from the President to the federal agencies they oversee.",
    expandedDefinition:
      "Executive orders direct how the executive branch operates and carries out existing law. They are not passed by Congress, can be revoked by a later President, and can be challenged in court.",
    category: "Executive",
    relatedTerms: ["rulemaking"],
  },
  {
    term: "rulemaking",
    pattern: /\brule ?making\b/i,
    shortDefinition: "The process agencies use to write the detailed rules that carry out a law.",
    expandedDefinition:
      "Laws often set direction and leave specifics to agencies. Rulemaking usually includes a public comment period, and the resulting rules carry legal force.",
    category: "Executive",
    relatedTerms: ["executive order"],
  },
  {
    term: "cosponsor",
    pattern: /\bcosponsor\w*/i,
    shortDefinition: "A member who formally adds their name in support of someone else's bill.",
    expandedDefinition:
      "Cosponsoring signals support and is part of the public record, but it is not a vote and carries no procedural weight. Members often cosponsor far more bills than ever receive a vote.",
    category: "Legislative process",
    relatedTerms: ["sponsor"],
  },
  {
    term: "sponsor",
    pattern: /\bsponsor\w*/i,
    shortDefinition: "The member who introduces a bill.",
    expandedDefinition:
      "Each bill has exactly one sponsor, the member who formally introduces it. Everyone else who signs on is a cosponsor.",
    category: "Legislative process",
    relatedTerms: ["cosponsor"],
  },
  {
    term: "quorum",
    pattern: /\bquorum\b/i,
    shortDefinition: "The minimum number of members who must be present for business to proceed.",
    expandedDefinition:
      "A majority of the chamber constitutes a quorum. Absent one, members can raise a point of order to halt proceedings until enough colleagues appear.",
    category: "Voting",
    relatedTerms: ["roll-call vote"],
  },
];

// Most specific first, so a referral is explained as a referral rather than
// matching the looser "sponsor" pattern that also appears in the same sentence.
const PRIORITY = [
  "continuing resolution", "conference committee", "motion to recommit",
  "referred to committee", "reported by", "executive order", "roll-call vote",
  "voice vote", "calendar", "markup", "cloture", "filibuster", "override",
  "veto", "rulemaking", "appropriation", "authorization", "quorum",
  "cosponsor", "sponsor",
];
const SORTED = PRIORITY.map((t) => JARGON.find((j) => j.term === t)).filter(
  (t): t is JargonTerm => !!t
);

export function findTerm(name: string): JargonTerm | null {
  const n = name.trim().toLowerCase();
  return JARGON.find((t) => t.term === n) ?? null;
}

/**
 * The first recognized term appearing in a piece of official text — used to
 * anchor a learning card to something the reader is actually looking at,
 * rather than teaching a term at random.
 */
export function detectTerm(text: string | null | undefined): JargonTerm | null {
  if (!text) return null;
  return SORTED.find((t) => t.pattern.test(text)) ?? null;
}
