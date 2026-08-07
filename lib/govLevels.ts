import { RepLevel } from "./types";

/**
 * The three tabs the Representatives screen groups officials into, and the
 * civics copy that explains each one.
 *
 * The chips are drawn from each level's own description rather than invented
 * separately, so the summary and the chip list can't drift apart.
 */
export type GovLevel = "Local" | "State" | "Federal";

export const GOV_LEVELS: GovLevel[] = ["Local", "State", "Federal"];

/** County officials are local government as far as a reader is concerned. */
export function tabForLevel(level: RepLevel): GovLevel {
  return level === "County" ? "Local" : level;
}

export function govLevelCopy(level: GovLevel, stateName: string | null) {
  switch (level) {
    case "Local":
      return {
        title: "Local government",
        description:
          "Handles county and city services such as zoning, schools, roads, policing, permits and local taxes.",
        chips: ["Zoning", "Schools", "Roads", "Policing", "Permits", "Local taxes"],
        why: "Local officials make the decisions you feel first — what gets built, how streets and schools are run, and what you pay in local taxes.",
      };
    case "State":
      return {
        title: "State government",
        description: `Handles ${stateName ?? "state"} laws, state taxes, schools, transportation and statewide programs.`,
        chips: ["State laws", "State taxes", "Schools", "Transportation", "Elections", "Statewide programs"],
        why: `State officials set much of the law that applies across ${stateName ?? "your state"}, from taxes and schools to how elections are run.`,
      };
    case "Federal":
      return {
        title: "Federal government",
        description: "Handles national laws, federal taxes, immigration, defense and nationwide programs.",
        chips: ["National laws", "Federal taxes", "Immigration", "Defense", "Social Security", "Interstate commerce"],
        why: "Federal officials create laws and policies that impact the entire country, including taxes, rights and national programs.",
      };
  }
}

const OFFICE_LABELS: Record<string, string> = {
  "US Senator": "U.S. Senator",
  "US House representative": "U.S. House",
};

/**
 * The office line under a name. A House member's district is appended when we
 * know it — split ZIPs can't identify one, so those just read "U.S. House".
 */
export function officeLine(role: string, district: string | null): string {
  const base = OFFICE_LABELS[role] ?? role;
  return district ? `${base} · ${district}` : base;
}
