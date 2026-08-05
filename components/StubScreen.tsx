import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { color } from "@/lib/tokens";

/**
 * Placeholder for screens not yet built: Explore, Saved, You.
 * Mirrors components/StubScreen.tsx in the web repo.
 */
export function StubScreen({ title }: { title: string }) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          Not built yet in this starter — mirrors the same stub on web, next in the build order.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.light.canvas },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  title: { fontSize: 18, fontWeight: "700", color: color.light.ink, marginBottom: 8 },
  subtitle: { fontSize: 13.5, color: color.light.muted, textAlign: "center" },
});
