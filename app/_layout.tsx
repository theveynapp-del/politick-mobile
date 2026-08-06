import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, ActivityIndicator, Platform } from "react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { color } from "@/lib/tokens";
import { getOnboardingComplete } from "@/lib/onboarding";

/**
 * Web-only: loads Inter via the Google Fonts CDN and waits for it to
 * actually finish loading before resolving.
 *
 * Why this exists, not the more obvious approach: expo-font's own runtime
 * @font-face injection (via useFonts, same hook used for native below) does
 * not reliably complete in this project's static web-export output — text
 * silently fell back to the browser's true default (serif) with no error.
 * Direct DOM injection + the CSS Font Loading API is a lower-level, more
 * verifiable mechanism: it doesn't just assume the fonts loaded because a
 * promise resolved, it explicitly forces each weight to download and
 * confirms completion before this resolves.
 */
function useWebFontsLoaded(): boolean {
  const [loaded, setLoaded] = useState(Platform.OS !== "web");

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const linkPreconnect1 = document.createElement("link");
    linkPreconnect1.rel = "preconnect";
    linkPreconnect1.href = "https://fonts.googleapis.com";
    document.head.appendChild(linkPreconnect1);

    const linkPreconnect2 = document.createElement("link");
    linkPreconnect2.rel = "preconnect";
    linkPreconnect2.href = "https://fonts.gstatic.com";
    linkPreconnect2.crossOrigin = "anonymous";
    document.head.appendChild(linkPreconnect2);

    const linkStylesheet = document.createElement("link");
    linkStylesheet.rel = "stylesheet";
    linkStylesheet.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(linkStylesheet);

    const weights = [400, 500, 600, 700, 800];
    Promise.all(weights.map((w) => document.fonts.load(`${w} 16px Inter`)))
      .then(() => setLoaded(true))
      .catch(() => setLoaded(true)); // don't block the app forever if a font genuinely can't load

    // Safety net: never block first paint more than 3s even if something
    // about font loading hangs — a slightly-wrong font beats a blank screen.
    const timeout = setTimeout(() => setLoaded(true), 3000);
    return () => clearTimeout(timeout);
  }, []);

  return loaded;
}

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  const [nativeFontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const webFontsLoaded = useWebFontsLoaded();
  const fontsLoaded = Platform.OS === "web" ? webFontsLoaded : nativeFontsLoaded;

  useEffect(() => {
    getOnboardingComplete().then((complete) => {
      const inOnboarding = segments[0] === "onboarding";
      if (!complete && !inOnboarding) {
        router.replace("/onboarding");
      }
      setOnboardingChecked(true);
    });
    // Only run this check once, on mount — the onboarding screen itself
    // owns navigating away when the user actually finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = fontsLoaded && onboardingChecked;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {!ready ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.light.canvas }}>
          <ActivityIndicator color={color.brand.deepTeal} />
        </View>
      ) : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
        </Stack>
      )}
    </SafeAreaProvider>
  );
}
