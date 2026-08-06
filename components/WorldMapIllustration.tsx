import Svg, { Rect, Circle } from "react-native-svg";
import { color } from "@/lib/tokens";

/**
 * Flat, muted world-map placeholder for Explore's "Around the world" module.
 * Per the brand guide: muted geography, one active highlight color, no
 * literal placeholder text shown to users (that was a real bug — internal
 * dev notes were rendering as visible UI copy).
 */
export function WorldMapIllustration({ width = 335, height = 110 }: { width?: number; height?: number }) {
  // A handful of abstract "landmass" blocks plus location dots — deliberately
  // not a literal accurate map, matching the guide's "muted geography" note.
  const landmasses = [
    { x: 20, y: 30, w: 55, h: 28 },
    { x: 95, y: 20, w: 40, h: 45 },
    { x: 155, y: 35, w: 65, h: 30 },
    { x: 240, y: 25, w: 50, h: 40 },
    { x: 60, y: 65, w: 35, h: 25 },
  ];
  const dots = [
    { cx: 45, cy: 40 },
    { cx: 115, cy: 35 },
    { cx: 185, cy: 45 },
    { cx: 260, cy: 40 },
  ];

  return (
    <Svg width={width} height={height} viewBox="0 0 335 110">
      <Rect x="0" y="0" width="335" height="110" rx="14" fill={color.brand.softTeal} />
      {landmasses.map((m, i) => (
        <Rect key={i} x={m.x} y={m.y} width={m.w} height={m.h} rx={6} fill={color.light.surface} opacity={0.6} />
      ))}
      {dots.map((d, i) => (
        <Circle key={i} cx={d.cx} cy={d.cy} r={4} fill={color.brand.deepTeal} />
      ))}
    </Svg>
  );
}
