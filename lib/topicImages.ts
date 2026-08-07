/**
 * Per-topic photography, used only when a story has no photo of its own.
 *
 * Every image is a real, freely-licensed photograph from Wikimedia Commons
 * (PD / CC0 / CC BY / CC BY-SA), bundled locally rather than hotlinked. They
 * are chosen to read clearly at ~105px and to follow the app's imagery rules:
 * no identifiable faces, no flags, no partisan colour-coding.
 *
 * Deliberately absent, and meant to stay that way:
 *
 * - Elections — the available ballot-box photography is covered in
 *   stars-and-stripes, which reads as partisan decoration.
 * - Government Operations — no neutral, unmistakably-US option surfaced; the
 *   best match was a foreign city hall, which would misinform.
 * - Conflict and foreign-affairs topics (Ukraine War, Middle East, Iraq,
 *   West Africa…) — a generic stock image beside a specific bombing or
 *   killing is exploitative and can misrepresent the event. These use the
 *   article's own photo or none at all.
 *
 * Anything unmapped falls back to the abstract scope thumbnail, which is
 * honest about being a placeholder.
 */
export const topicImages: Record<string, number> = {
  Congress: require("../assets/topics/congress.jpg"),
  "Public Lands and Natural Resources": require("../assets/topics/public-lands.jpg"),
  "Housing and Community Development": require("../assets/topics/housing.jpg"),
  Health: require("../assets/topics/health.jpg"),
  Education: require("../assets/topics/education.jpg"),
  Transportation: require("../assets/topics/transportation.jpg"),
  "Public Transit": require("../assets/topics/transit.jpg"),
  Technology: require("../assets/topics/technology.jpg"),
};

export function topicImageFor(topic: string): number | null {
  return topicImages[topic] ?? null;
}
