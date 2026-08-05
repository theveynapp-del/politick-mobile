import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, ActivityIndicator } from "react-native";
import { color } from "@/lib/tokens";
import { getOnboardingComplete } from "@/lib/onboarding";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getOnboardingComplete().then((complete) => {
      const inOnboarding = segments[0] === "onboarding";
      if (!complete && !inOnboarding) {
        router.replace("/onboarding");
      }
      setReady(true);
    });
    // Only run this check once, on mount — the onboarding screen itself
    // owns navigating away when the user actually finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
