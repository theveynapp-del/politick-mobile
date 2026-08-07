import { Story } from "./types";

/**
 * Estimated reading time from the story's actual body text at ~200 wpm.
 * Derived rather than stored, so it can't drift from the copy it describes —
 * and never a made-up number.
 */
export function estimateReadMinutes(story: Story): number {
  const words = `${story.whatHappened} ${story.whyItMatters}`.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}
