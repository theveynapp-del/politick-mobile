import React from "react";
import Svg, { Rect, Circle, Path } from "react-native-svg";
import { color } from "@/lib/tokens";
import { TopicScope } from "@/lib/types";

/**
 * Story thumbnails, per scope. Congress.gov (and our other real data
 * sources) don't provide per-story photography, so this deliberately does
 * NOT fabricate a fake "documentary photo" implying it depicts the actual
 * event — that would misrepresent real content. Instead: flat, abstract,
 * brand-colored category icons, matching the same illustration language as
 * onboarding's CivicIllustration. Honest and visually consistent, not a
 * placeholder pretending to be something it isn't.
 */
export function StoryThumbnail({ scope, size = 76 }: { scope: TopicScope; size?: number }) {
  const bg = SCOPE_BG[scope];
  return (
    <Svg width={size} height={size} viewBox="0 0 76 76">
      <Rect x="0" y="0" width="76" height="76" rx="12" fill={bg} />
      {ICONS[scope]}
    </Svg>
  );
}

const SCOPE_BG: Record<TopicScope, string> = {
  Federal: color.brand.softTeal,
  State: color.brand.warmSand,
  Local: color.brand.warmSand,
  World: color.brand.softTeal,
};

// Simple, flat geometric marks — a dome for Federal/State (capitol-style
// buildings), a low building for Local, a globe for World. Deliberately
// under-detailed to avoid reading as any specific real building.
const ICONS: Record<TopicScope, React.ReactElement> = {
  Federal: (
    <>
      <Rect x="18" y="42" width="40" height="20" fill={color.brand.deepTeal} opacity={0.85} />
      <Circle cx="38" cy="36" r="14" fill={color.brand.deepTeal} opacity={0.85} />
      <Rect x="33" y="20" width="10" height="14" fill={color.brand.deepTeal} opacity={0.85} />
    </>
  ),
  State: (
    <>
      <Rect x="16" y="44" width="44" height="18" fill={color.brand.deepTeal} opacity={0.7} />
      <Path d="M16 44 L38 26 L60 44 Z" fill={color.brand.deepTeal} opacity={0.7} />
    </>
  ),
  Local: (
    <>
      <Rect x="14" y="34" width="20" height="28" fill={color.brand.deepTeal} opacity={0.75} />
      <Rect x="40" y="24" width="22" height="38" fill={color.brand.deepTeal} opacity={0.6} />
    </>
  ),
  World: (
    <>
      <Circle cx="38" cy="38" r="22" fill="none" stroke={color.brand.deepTeal} strokeWidth={2.5} opacity={0.75} />
      <Path d="M16 38 H60 M38 16 V60 M22 24 Q38 38 22 52 M54 24 Q38 38 54 52" stroke={color.brand.deepTeal} strokeWidth={1.5} fill="none" opacity={0.5} />
    </>
  ),
};
