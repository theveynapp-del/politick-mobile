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
  photoUrl: string | null;
}
