import { Text as RNText, TextProps, StyleSheet, Platform } from "react-native";

/**
 * Drop-in replacement for React Native's Text that always renders in Inter.
 *
 * Native (iOS/Android): each weight is a separately-named font asset loaded
 * via @expo-google-fonts/inter — RN doesn't apply fontWeight to custom fonts
 * the way CSS does, so this maps fontWeight to the matching discrete family
 * name (e.g. "Inter_600SemiBold").
 *
 * Web: fonts are loaded via the Google Fonts CDN (see app/+html.tsx) as a
 * single "Inter" family with weight variants — the discrete native family
 * names above don't exist as CSS font-family strings, so using them on web
 * silently falls back to the browser's default serif font. This is exactly
 * the bug that shipped once already; the platform branch below is the fix.
 */
const WEIGHT_TO_FAMILY: Record<string, string> = {
  "400": "Inter_400Regular",
  normal: "Inter_400Regular",
  "500": "Inter_500Medium",
  "600": "Inter_600SemiBold",
  "700": "Inter_700Bold",
  bold: "Inter_700Bold",
  "800": "Inter_800ExtraBold",
};

export function Text({ style, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) || {};

  if (Platform.OS === "web") {
    return <RNText style={[{ fontFamily: "Inter" }, style]} {...rest} />;
  }

  const weightKey = String(flat.fontWeight ?? "400");
  const family = WEIGHT_TO_FAMILY[weightKey] ?? "Inter_400Regular";
  return <RNText style={[{ fontFamily: family }, style]} {...rest} />;
}
