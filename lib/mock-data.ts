import { Story, Representative } from "./types";

export const todayStories: Story[] = [
  {
    id: "d1",
    topic: "Congress",
    scope: "Federal",
    updated: "2h ago",
    headline: "House committee advances child tax credit expansion",
    whatHappened:
      "A House committee voted to advance a bill raising the child tax credit and shifting it to monthly payments instead of one lump sum at tax time.",
    whyItMatters:
      "If it becomes law, families with kids under 17 would see extra money in their account every month starting next year.",
    zipNote: "Your representative has not co-sponsored it.",
    storyMap: {
      status: "Committee advanced",
      sponsor: "Rep. D. Álvarez (D-CA-27)",
      cosponsors: "38 total (31D, 7R)",
      nextCheckpoint: "Full committee markup, Thursday",
      fiscalNote: "$142B over 10 years (CBO)",
    },
    sources: [
      { label: "Bill text · HR 4821", type: "Primary source", domain: "congress.gov" },
      { label: "CBO cost estimate", type: "Official data", domain: "cbo.gov" },
      { label: "Committee vote coverage", type: "Reporting", domain: "reuters.com" },
    ],
  },
  {
    id: "d2",
    topic: "Congress",
    scope: "Federal",
    updated: "3h ago",
    headline: "Senate committee advances AI hiring disclosure rules",
    whatHappened:
      "A Senate committee voted 14-9 to advance a bill requiring companies to disclose when AI is used to screen job applicants.",
    whyItMatters:
      "Employers using AI résumé screening or interview scoring would have to tell you, and let you request a human review if you're rejected.",
    zipNote: "Three employers in your metro area already follow a similar state law.",
    storyMap: {
      status: "Committee advanced",
      sponsor: "Sen. K. Whitfield (R-OH)",
      cosponsors: "Bipartisan, 14-9 committee vote",
      nextCheckpoint: "Floor scheduling, not yet set",
      fiscalNote: "Not yet scored",
    },
    sources: [
      { label: "Bill text · S 2210", type: "Primary source", domain: "congress.gov" },
      { label: "PAC spending disclosure", type: "Official data", domain: "opensecrets.org" },
      { label: "Colorado's similar law (2024)", type: "Official data", domain: "leg.colorado.gov" },
    ],
  },
  {
    id: "d3",
    topic: "Small Business",
    scope: "Federal",
    updated: "6h ago",
    headline: "Small-business cybersecurity tax credit introduced",
    whatHappened:
      "A House member introduced a bill creating a tax credit for small businesses that invest in cybersecurity software and staff training.",
    whyItMatters:
      "If you run a small business, this could let you write off up to $10,000 in security upgrades.",
    zipNote: "Your representative sits on the committee reviewing this bill.",
    storyMap: {
      status: "Introduced",
      sponsor: "Rep. T. Osei (D-MD-4)",
      cosponsors: "12 total (9D, 3R)",
      nextCheckpoint: "Committee markup, date not yet set",
      fiscalNote: "Not yet scored",
    },
    sources: [
      { label: "Bill text · HR 5590", type: "Primary source", domain: "congress.gov" },
      { label: "NFIB statement of support", type: "Reporting", domain: "nfib.com" },
    ],
  },
  {
    id: "g1",
    topic: "World",
    scope: "World",
    updated: "45m ago",
    headline: "China holds larger military exercises near Taiwan",
    whatHappened:
      "China conducted military exercises near Taiwan that were larger in scale than recent drills.",
    whyItMatters:
      "It doesn't signal imminent conflict, but it raises tension and touches shipping and chip supply chains — the kind of thing that can show up later as pricier electronics.",
    zipNote: "Relevant if you hold semiconductor exposure or buy electronics regularly.",
    storyMap: {
      status: "Ongoing, 3rd exercise of this scale in 14 months",
      sponsor: "Taiwan Ministry of National Defense (monitoring)",
      cosponsors: "US 7th Fleet repositioning",
      nextCheckpoint: "Scheduled US carrier group transit, next week",
      fiscalNote: "TSM -2.1% on the news",
    },
    sources: [
      { label: "Taiwan MND press release", type: "Primary source", domain: "mnd.gov.tw" },
      { label: "Market reaction coverage", type: "Reporting", domain: "reuters.com" },
      { label: "ChinaPower tracker", type: "Nonpartisan analysis", domain: "csis.org" },
    ],
  },
  {
    id: "g2",
    topic: "Trade",
    scope: "World",
    updated: "4h ago",
    headline: "EU-Mercosur trade deal nears a ratification vote",
    whatHappened:
      "A long-negotiated trade deal between Europe and South American countries is close to a ratification vote, despite opposition from French farmers.",
    whyItMatters:
      "If it passes, EU groceries could get slightly cheaper, and US agricultural exporters would face tougher competition in the same markets.",
    zipNote: "Worth watching if you hold agricultural-sector positions or work in US ag exports.",
    storyMap: {
      status: "Ratification vote pending",
      sponsor: "European Commission",
      cosponsors: "Blocking coalition: France, Poland, partial Ireland",
      nextCheckpoint: "EU Parliament vote, next quarter",
      fiscalNote: "Displaces US soy/beef market share in the EU",
    },
    sources: [
      { label: "European Commission text", type: "Primary source", domain: "ec.europa.eu" },
      { label: "Copa-Cogeca statement", type: "Reporting", domain: "copa-cogeca.eu" },
      { label: "Deal terms coverage", type: "Reporting", domain: "ft.com" },
    ],
  },
];

export const representatives: Representative[] = [
  {
    id: "r1",
    level: "Federal",
    role: "US Senator",
    controls: "Senate votes and confirmations",
    name: "Sen. R. Talbot",
    jurisdictionConfidence: "High",
    photoUrl: null,
    phone: null,
    website: null,
  },
  {
    id: "r2",
    level: "Federal",
    role: "US Senator",
    controls: "Senate votes and confirmations",
    name: "Sen. M. Okafor",
    jurisdictionConfidence: "High",
    photoUrl: null,
    phone: null,
    website: null,
  },
  {
    id: "r3",
    level: "Federal",
    role: "US House representative",
    controls: "Federal laws and spending",
    name: "Rep. D. Álvarez",
    jurisdictionConfidence: "High",
    photoUrl: null,
    phone: null,
    website: null,
  },
  {
    id: "r4",
    level: "State",
    role: "State delegate",
    controls: "State laws and budget",
    name: "Del. J. Farrow",
    jurisdictionConfidence: "High",
    photoUrl: null,
    phone: null,
    website: null,
  },
  {
    id: "r5",
    level: "County",
    role: "County council member",
    controls: "Zoning, roads, local services",
    name: "Councilmember P. Reyes",
    jurisdictionConfidence: "Needs review",
    photoUrl: null,
    phone: null,
    website: null,
  },
];
