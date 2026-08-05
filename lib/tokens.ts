// Mirrors lib/tokens.json in the politick-app (web) repo. Kept in sync manually
// since React Native has no CSS custom properties — these are plain JS values
// used directly in StyleSheet definitions.

export const color = {
  light: {
    canvas: "#F7F6F2",
    surface: "#FFFFFF",
    ink: "#101418",
    muted: "#5D6670",
    border: "#DDE1E5",
  },
  dark: {
    canvas: "#0D1114",
    surface: "#161C20",
    ink: "#EDF1F2",
    muted: "#A8B0B6",
    border: "#2C353B",
  },
  brand: {
    civicTeal: "#167D79",
    deepTeal: "#0D5F5B",
    softTeal: "#DCEFED",
    signalGold: "#D9A441",
    warmSand: "#EEE9DE",
    actionCoral: "#B84E3C",
  },
};

export const radius = {
  button: 12,
  card: 16,
  sheet: 24,
  chip: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  page: 20,
  section: 24,
};

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: "700" as const },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: "700" as const },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: "600" as const },
  h3: { fontSize: 16, lineHeight: 22, fontWeight: "600" as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
  bodyCompact: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "600" as const },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: "500" as const },
};

export const touchTarget = { min: 44 };
