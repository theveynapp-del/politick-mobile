/**
 * Normalises Congress.gov's free-text latest-action into one of six stages.
 *
 * The action text is the only stage signal the API gives, so this reads it
 * rather than inventing a status. Anything unrecognised returns null and the
 * UI shows the raw action instead — a wrong stage badge is worse than none.
 */
export type BillStage =
  | "Introduced"
  | "Committee"
  | "Floor vote"
  | "Other chamber"
  | "President"
  | "Law"
  | "Failed";

export const BILL_STAGES: BillStage[] = [
  "Introduced",
  "Committee",
  "Floor vote",
  "Other chamber",
  "President",
  "Law",
];

/** Ordered most-final first, so "Became Public Law" wins over "Referred to". */
const RULES: [RegExp, BillStage][] = [
  [/became public law|signed by president|public law no/i, "Law"],
  [/vetoed|failed|rejected|motion to table agreed|postponed indefinitely/i, "Failed"],
  [/presented to president|to president/i, "President"],
  [/received in the senate|received in the house|held at the desk|passed\/agreed to in (house|senate)/i, "Other chamber"],
  [/passed house|passed senate|on passage|roll call|agreed to by (the )?(yea|recorded)/i, "Floor vote"],
  [/placed on .*calendar|reported by|ordered to be reported|markup|hearings held/i, "Committee"],
  [/referred to/i, "Committee"],
  [/introduced|sponsor introductory/i, "Introduced"],
];

export function stageFromAction(actionText: string | null | undefined): BillStage | null {
  if (!actionText) return null;
  for (const [pattern, stage] of RULES) {
    if (pattern.test(actionText)) return stage;
  }
  return null;
}

/** Index within BILL_STAGES, for rendering a journey. -1 when off the ladder. */
export function stageIndex(stage: BillStage | null): number {
  if (!stage) return -1;
  return BILL_STAGES.indexOf(stage);
}

/**
 * What a bill at this stage does next. Phrased as possibility, not prediction —
 * most bills at any stage simply stop, and implying forward motion would
 * overstate what the record supports.
 */
export function whatHappensNext(stage: BillStage | null): string | null {
  switch (stage) {
    case "Introduced":
      return "It will be referred to one or more committees, which may or may not take it up.";
    case "Committee":
      return "The committee may hold hearings, amend it, vote to advance it, or take no further action.";
    case "Floor vote":
      return "If it passed, it moves to the other chamber, which starts its own committee process.";
    case "Other chamber":
      return "The second chamber considers it. If it passes in a different form, the two versions must be reconciled.";
    case "President":
      return "The President may sign it, veto it, or let it become law without a signature.";
    case "Law":
      return "It is enacted. Agencies now write the rules that carry it out.";
    case "Failed":
      return "This measure is no longer advancing in its current form.";
    default:
      return null;
  }
}
