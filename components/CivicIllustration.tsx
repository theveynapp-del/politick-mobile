import React from "react";
import Svg, { Rect, Circle, Path, Line } from "react-native-svg";
import { color } from "@/lib/tokens";

/**
 * Flat, muted civic-building scene for onboarding's welcome screen — per
 * the brand guide's illustration rule: no flags, rallies, partisan crowds,
 * gavels, or caricatures. Deliberately abstract/geometric, matching the
 * approved mockup's Capitol-and-plaza scene without any partisan symbolism.
 */
export function CivicIllustration({ width = 340, height = 200 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 340 200">
      {/* Sky/ground */}
      <Rect x="0" y="0" width="340" height="200" fill={color.brand.softTeal} opacity={0.5} />
      <Line x1="0" y1="160" x2="340" y2="160" stroke={color.light.border} strokeWidth={2} />

      {/* Building: simple dome + columns, flat/geometric, no partisan symbolism */}
      <Rect x="120" y="90" width="100" height="70" fill={color.brand.warmSand} />
      <Circle cx="170" cy="80" r="28" fill={color.brand.warmSand} />
      <Rect x="163" y="55" width="14" height="20" fill={color.brand.warmSand} />
      {Array.from({ length: 5 }).map((_, i) => (
        <Rect key={i} x={130 + i * 16} y="105" width="8" height="55" fill={color.light.surface} opacity={0.6} />
      ))}
      <Path d="M110 90 L170 55 L230 90 Z" fill={color.brand.deepTeal} opacity={0.85} />

      {/* Abstract, non-figurative "people" — simple dots + lines, deliberately
          not detailed enough to read as any individual or crowd scene */}
      {[60, 90, 250, 280].map((x, i) => (
        <React.Fragment key={i}>
          <Circle cx={x} cy="148" r="5" fill={color.light.muted} />
          <Line x1={x} y1="153" x2={x} y2="160" stroke={color.light.muted} strokeWidth={3} />
        </React.Fragment>
      ))}

      {/* Trees, simple */}
      <Circle cx="40" cy="130" r="18" fill={color.brand.civicTeal} opacity={0.5} />
      <Circle cx="300" cy="125" r="20" fill={color.brand.civicTeal} opacity={0.5} />
    </Svg>
  );
}
