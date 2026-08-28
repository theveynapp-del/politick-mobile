import { RepLevel } from "./types";

/**
 * What an office actually does, for someone who has never had to know.
 *
 * The representatives table carries a `controls` string, but it is one clause
 * long and keyed loosely — "Statewide executive office" for a Treasurer, and
 * "Local executive actions, city/county budget, appointments" for both a
 * Sheriff and a District Attorney, neither of which sets a budget. A reader
 * deciding whether to care about a name on a ballot learns nothing from that,
 * and in those two cases learns something false.
 *
 * Everything here is settled structure rather than reporting, which is why it
 * can be written down instead of fetched: the Senate confirms judges, revenue
 * bills start in the House, zoning is a council power. Where a power genuinely
 * varies by state or city charter — lieutenant governors, mayors, county
 * boards — `varies` says so rather than picking the most common arrangement
 * and stating it as fact.
 *
 * `limits` is deliberately part of the shape. Knowing that your member of
 * Congress cannot change your property tax is often the single most useful
 * thing on the screen, and it is the part no official source ever prints.
 */
export interface OfficeProfile {
  /** Plain name for the office, independent of the local job title. */
  title: string;
  /** One or two sentences: what this office is. */
  summary: string;
  /** Concrete powers — what actually lands on this desk. */
  decides: string[];
  /** What this office cannot do, stated because readers routinely assume it can. */
  limits?: string;
  /** Term length, only where it holds nationally. */
  term?: string;
  /** Set when the office's real powers differ by jurisdiction. */
  varies?: string;
}

const FEDERAL_SENATE: OfficeProfile = {
  title: "United States Senator",
  summary:
    "One of two senators for your entire state. Every state gets two regardless of population, so a voter in Wyoming has far more Senate influence per person than one in California.",
  decides: [
    "Votes on every federal bill, and can block one almost single-handedly through the filibuster",
    "Confirms federal judges — including Supreme Court justices, who serve for life",
    "Confirms Cabinet secretaries, agency heads and ambassadors",
    "Ratifies treaties with other countries",
    "Holds the trial when the House impeaches a federal official",
  ],
  limits:
    "Cannot change state law, set your property taxes, or alter local zoning. Those belong to your state legislature and city council.",
  term: "Six years. Roughly a third of the Senate is up at each election, so most states don't have a Senate race every cycle.",
};

const FEDERAL_HOUSE: OfficeProfile = {
  title: "U.S. Representative",
  summary:
    "Represents one congressional district — around 760,000 people — rather than a whole state. Yours is decided only by voters in your district.",
  decides: [
    "Votes on every federal bill",
    "Originates all tax and revenue legislation — by the Constitution, those bills must start in the House",
    "Sets federal spending, including what agencies and programs get funded",
    "Brings impeachment charges against federal officials",
  ],
  limits:
    "Does not confirm judges or Cabinet officials — that is the Senate's job alone. Cannot change state or local law.",
  term: "Two years. Every seat is contested every even year, the shortest term in federal government.",
};

const STATE_UPPER: OfficeProfile = {
  title: "State Senator",
  summary:
    "Sits in the upper chamber of your state legislature. Most law that touches an ordinary day is state law, not federal — this office writes it.",
  decides: [
    "Criminal law and sentencing, traffic law, and most of what police enforce",
    "Landlord–tenant rules, rent regulation and eviction procedure",
    "How schools are funded, and much of what they must teach",
    "The state budget, Medicaid, and professional licensing",
    "In most states, the district maps used for state and congressional elections",
  ],
  limits: "Cannot change federal law, and cannot pass city ordinances or rezone a specific parcel.",
  varies: "Chamber names and term lengths differ by state; a few states elect senators for two years rather than four.",
};

const STATE_LOWER: OfficeProfile = {
  title: "State Representative",
  summary:
    "Sits in the lower chamber of your state legislature — called the House, Assembly or House of Delegates depending on the state. Represents a smaller district than a state senator.",
  decides: [
    "Criminal law and sentencing, traffic law, and most of what police enforce",
    "Landlord–tenant rules, rent regulation and eviction procedure",
    "How schools are funded, and much of what they must teach",
    "The state budget, Medicaid, and professional licensing",
    "In most states, revenue bills start in this chamber",
  ],
  limits: "Cannot change federal law, and cannot pass city ordinances or rezone a specific parcel.",
  varies: "Called Representative, Delegate or Assemblymember depending on the state. Terms are usually two years.",
};

const GOVERNOR: OfficeProfile = {
  title: "Governor",
  summary:
    "Your state's chief executive. In practice the single most powerful official over daily life in the state.",
  decides: [
    "Signs or vetoes every bill the legislature passes",
    "Proposes the state budget, which frames the entire year's argument",
    "Appoints agency heads, and in many states judges",
    "Commands the state National Guard and declares state emergencies",
    "Grants pardons and commutations in most states",
  ],
  limits: "Cannot change federal law, and cannot directly rewrite a city's zoning code.",
  term: "Four years in almost every state.",
};

const LT_GOVERNOR: OfficeProfile = {
  title: "Lieutenant Governor",
  summary:
    "First in line to become governor. Beyond that, this is the office whose real power varies most from state to state.",
  decides: [
    "Becomes governor if the office is vacated",
    "Presides over the state senate in many states, sometimes casting tie-breaking votes",
    "Acts as governor while the governor is out of state, in some states",
  ],
  varies:
    "In some states this is a substantial job with agencies attached; in others it is close to ceremonial. A few states elect it jointly with the governor, and a few have no lieutenant governor at all.",
};

const ATTORNEY_GENERAL: OfficeProfile = {
  title: "State Attorney General",
  summary:
    "Your state's chief legal officer, and increasingly one of the most consequential offices on the ballot — state AGs are who sue or defend against federal policy.",
  decides: [
    "Which cases the state brings or defends, including suits against the federal government or other states",
    "Consumer protection enforcement — fraud, price-fixing, deceptive practices",
    "Legal opinions that bind state agencies until a court says otherwise",
    "Prosecution of some state-level crime, especially multi-county cases",
  ],
  varies: "In most states this is elected; in a handful the governor appoints it.",
};

const SECRETARY_OF_STATE: OfficeProfile = {
  title: "Secretary of State",
  summary:
    "In most states, the official who runs elections — which makes this a quiet office with unusually direct consequences.",
  decides: [
    "Voter registration systems and voter roll maintenance",
    "Certification of election results",
    "Rules and guidance county election officials follow",
    "Business registration and official state records",
  ],
  varies:
    "Not every state assigns elections here — some use an appointed board or a separate elections director.",
};

const TREASURER: OfficeProfile = {
  title: "State Treasurer",
  summary: "Holds and invests the state's money, and manages its borrowing.",
  decides: [
    "Where state funds are deposited and how they are invested",
    "Issuing state bonds, which determines what large projects can be financed",
    "Unclaimed property, and often college savings and retirement programs",
  ],
  varies: "Some states combine this office with the comptroller or auditor.",
};

const COMPTROLLER: OfficeProfile = {
  title: "Comptroller",
  summary:
    "The government's accountant and auditor — the office that checks whether money was actually spent the way it was supposed to be.",
  decides: [
    "Audits of agencies and programs, which frequently surface waste or fraud",
    "Official accounting of what the government has spent and owes",
    "In several states, the revenue forecast the budget must be built on",
  ],
  varies: "Called Comptroller, Controller or Auditor depending on the state or city.",
};

const MAYOR: OfficeProfile = {
  title: "Mayor",
  summary:
    "The head of city government — though how much that means depends entirely on the city's charter.",
  decides: [
    "Proposes the city budget",
    "Appoints or oversees department heads, including the police chief in most cities",
    "Signs or vetoes ordinances the council passes",
    "Sets the agenda and the public priorities for the city",
  ],
  varies:
    'In a "strong mayor" city this office runs the government day to day. In a "council–manager" city a professional manager runs operations and the mayor mostly presides over the council.',
};

const COUNCIL: OfficeProfile = {
  title: "City or County Council Member",
  summary:
    "The closest elected office to you, deciding the things you actually see — and usually the lowest-turnout race on the ballot.",
  decides: [
    "Zoning and land use, which is the single biggest lever government has over housing costs",
    "The city or county budget, including how much goes to police, fire and transit",
    "Local ordinances — noise, short-term rentals, parking, business rules",
    "Property tax rates, in many jurisdictions",
    "Water, trash, parks, libraries, permits and street maintenance",
  ],
  limits: "Cannot change state or federal law, though it can often decide how forcefully local rules are enforced.",
  varies:
    "Called Councilmember, Councilor, Alderman, Supervisor or Commissioner depending on the place. Some are elected by district, others citywide.",
};

const COUNTY_EXECUTIVE: OfficeProfile = {
  title: "County Executive",
  summary:
    "Runs county government, which handles the services cities often don't — and which many residents never realise they're voting on.",
  decides: [
    "The county budget and county agencies",
    "Public health services, and in many counties the hospital system",
    "The county jail, and often election administration",
    "Roads, permitting and services in unincorporated areas outside any city",
  ],
  varies:
    "Some counties elect an executive; others are run by a board chair or an appointed administrator.",
};

const SHERIFF: OfficeProfile = {
  title: "Sheriff",
  summary:
    "An elected law enforcement officer — which makes this office unusual: unlike a police chief, a sheriff generally answers to voters rather than to a mayor or council.",
  decides: [
    "Runs the county jail, including conditions and medical care inside it",
    "Patrols unincorporated areas that have no city police force",
    "Serves warrants, court papers and eviction notices",
    "Court security and prisoner transport",
    "How far the office cooperates with federal immigration enforcement, in many counties",
  ],
  limits: "Does not prosecute cases or set sentences — that is the district attorney and the courts.",
};

const DISTRICT_ATTORNEY: OfficeProfile = {
  title: "District Attorney",
  summary:
    "Decides who gets charged with a crime and with what — arguably the most consequential office on a local ballot, and one of the least watched.",
  decides: [
    "Which arrests become criminal charges, and which are dropped",
    "What a person is charged with, which sets the possible sentence before any trial",
    "Plea offers, which resolve the overwhelming majority of criminal cases",
    "Whether to pursue charges against police officers",
  ],
  limits: "Does not decide guilt or impose the sentence — a judge or jury does that.",
  varies: "Called District Attorney, State's Attorney, Prosecuting Attorney or County Attorney depending on the state.",
};

/**
 * Longest, most specific patterns first: "council president" must not fall
 * through to the generic council entry, and "county executive" must not be
 * caught by a bare "executive".
 */
const MATCHERS: { test: RegExp; profile: OfficeProfile; level?: RepLevel }[] = [
  { test: /\bus\s+senator\b|\bu\.s\.\s+senator\b/, profile: FEDERAL_SENATE, level: "Federal" },
  { test: /\bus\s+house\b|\brepresentative\b/, profile: FEDERAL_HOUSE, level: "Federal" },

  // Before GOVERNOR on purpose: /\bgovernor\b/ matches inside "Lieutenant
  // Governor", which credited a lieutenant governor with the veto, the
  // National Guard and the pardon power.
  { test: /\blieutenant\s+governor\b|\blt\.?\s+governor\b/, profile: LT_GOVERNOR },
  { test: /\bgovernor\b/, profile: GOVERNOR, level: "State" },
  { test: /\battorney\s+general\b/, profile: ATTORNEY_GENERAL, level: "State" },
  { test: /\bsecretary\s+of\s+state\b/, profile: SECRETARY_OF_STATE, level: "State" },
  { test: /\btreasurer\b/, profile: TREASURER, level: "State" },

  { test: /\bdistrict\s+attorney\b|\bstate'?s\s+attorney\b|\bprosecuting\s+attorney\b/, profile: DISTRICT_ATTORNEY },
  { test: /\bsheriff\b/, profile: SHERIFF },
  { test: /\bcounty\s+executive\b|\bcounty\s+board\s+president\b|\bborough\s+president\b/, profile: COUNTY_EXECUTIVE },
  { test: /\bmayor\b/, profile: MAYOR, level: "Local" },
  { test: /\bcomptroller\b|\bcontroller\b/, profile: COMPTROLLER },

  { test: /\bsenator\b/, profile: STATE_UPPER, level: "State" },
  { test: /\bdelegate\b|\bassembly(man|woman|member)?\b/, profile: STATE_LOWER, level: "State" },

  {
    test: /\bcouncil|\balderm[ae]n\b|\bsupervisor\b|\bcommissioner\b|\bchairman\b/,
    profile: COUNCIL,
    level: "Local",
  },
];

/**
 * The profile for a role, or null when the title isn't one we can speak to.
 *
 * Null is a real answer: the caller falls back to the record's own `controls`
 * string rather than this module inventing powers for an office it doesn't
 * recognise.
 */
export function officeProfileFor(role: string, level: RepLevel): OfficeProfile | null {
  const r = role.toLowerCase().trim();
  for (const m of MATCHERS) {
    if (!m.test.test(r)) continue;
    // "Representative" means a very different office federally and in a state
    // legislature, and both use the bare word.
    if (m.level && m.level !== level) continue;
    return m.profile;
  }
  // A state-level "Representative" reaches here because the federal matcher
  // above is Federal-only.
  if (level === "State" && /\brepresentative\b/.test(r)) return STATE_LOWER;
  return null;
}
