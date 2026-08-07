import { Story } from "./types";

/**
 * Copy shown when a story has no relevance note for the reader's ZIP. Lives
 * here rather than inline in queries.ts so the feed can recognise it and avoid
 * presenting it as personalisation.
 */
export const NO_ZIP_NOTE = "We don't have local relevance for this zip code yet.";

/** The ingest writes one of these wherever a legislative field has no value. */
function isPlaceholder(value: string): boolean {
  return /^(not applicable|not yet|unknown|n\/a|tbd)/i.test(value.trim());
}

/**
 * How much substance is actually behind a story, counted as the number of the
 * five fields the story screen's "Go Deeper" tab renders that carry a real
 * value rather than a placeholder.
 */
export function policyDepth(story: Story): number {
  const { status, sponsor, cosponsors, nextCheckpoint, fiscalNote } = story.storyMap;
  return [status, sponsor, cosponsors, nextCheckpoint, fiscalNote].filter((v) => !isPlaceholder(v)).length;
}

/**
 * Whether to offer the Go deeper action. The threshold is 4 of 5 because a bare
 * majority doesn't distinguish anything — every legislative story clears 3,
 * so a lower bar would put the action on nearly every card, which is exactly
 * what it's meant to avoid. At 4 it currently marks 14 of 37 stories.
 */
export function hasPolicyDetail(story: Story): boolean {
  return policyDepth(story) >= 4;
}

/**
 * The "why it matters" row.
 *
 * Only a story with a note written for the reader's own ZIP can honestly claim
 * to matter "to you". Most stories have no such note, so they fall back to the
 * story's general stakes under a label that doesn't overstate what it is —
 * rather than dressing up generic copy as personalisation.
 */
export function relevanceFor(story: Story): { label: string; text: string; personal: boolean } {
  const note = story.zipNote?.trim();
  if (note && note !== NO_ZIP_NOTE) {
    return { label: "Why it matters to you:", text: note, personal: true };
  }
  return { label: "Why it matters:", text: story.whyItMatters, personal: false };
}
