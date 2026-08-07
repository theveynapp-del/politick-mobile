export type SourceType =
  | "Primary source"
  | "Official data"
  | "Nonpartisan analysis"
  | "Reporting"
  | "Opinion";

export type TopicScope = "Local" | "State" | "Federal" | "World";

export interface Source {
  label: string;
  type: SourceType;
  domain: string;
}

export interface StoryMap {
  status: string;
  sponsor: string;
  cosponsors: string;
  nextCheckpoint: string;
  fiscalNote: string;
}

export interface Story {
  id: string;
  topic: string;
  scope: TopicScope;
  updated: string;
  headline: string;
  whatHappened: string;
  whyItMatters: string;
  /**
   * The story's own photograph, when its source publishes one (news articles
   * do; bill trackers don't). Null means fall back to topic imagery.
   */
  imageUrl: string | null;
  zipNote: string;
  storyMap: StoryMap;
  sources: Source[];
}

export type RepLevel = "Local" | "County" | "State" | "Federal";

export interface Representative {
  id: string;
  level: RepLevel;
  role: string;
  controls: string;
  name: string;
  jurisdictionConfidence: "High" | "Needs review";
  /**
   * Congressional district for US House members, e.g. "MD-08" ("DE-AL" for an
   * at-large seat). Null for every other office, and for House members whose
   * ZIP straddles two districts — the source can't say which seat is theirs.
   */
  district: string | null;
  photoUrl: string | null;
  phone: string | null;
  website: string | null;
}
