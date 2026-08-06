import { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Bookmark } from "lucide-react-native";
import { color } from "@/lib/tokens";
import { supabase } from "@/lib/supabase";
import { getTodayStories } from "@/lib/queries";
import { getStoredZip } from "@/lib/onboarding";
import { getSavedIds, toggleSavedId } from "@/lib/savedStories";
import { Story } from "@/lib/types";
import { StoryCard } from "@/components/StoryCard";

/**
 * Saved — reads from the same AsyncStorage-backed store that Today's
 * bookmark button writes to, so saving a story on Today actually shows up
 * here instead of resetting on navigation.
 */
export default function SavedScreen() {
  const [stories, setStories] = useState<Story[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [ids, zip] = await Promise.all([getSavedIds(), getStoredZip()]);
    const all = await getTodayStories(supabase, zip ?? "20814");
    setSavedIds(ids);
    setStories(all.filter((s) => ids.includes(s.id)));
    setLoading(false);
  }, []);

  // Refetch every time this tab gains focus, so a save made on Today shows
  // up immediately without needing a manual refresh.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Saved</Text>
        <Text style={styles.subtitle}>Stories you&rsquo;ve bookmarked from Today.</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={color.brand.deepTeal} />
      ) : (
        <FlatList
          data={stories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <StoryCard
              story={item}
              saved={savedIds.includes(item.id)}
              onToggleSave={async () => {
                const next = await toggleSavedId(item.id);
                setSavedIds(next);
                setStories((prev) => prev.filter((s) => next.includes(s.id)));
              }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Bookmark size={26} color={color.light.muted} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>Nothing saved yet</Text>
              <Text style={styles.emptyDesc}>Tap the bookmark on any story in Today to keep it here.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.light.canvas },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 20, fontWeight: "700", color: color.light.ink, marginBottom: 3 },
  subtitle: { fontSize: 13, color: color.light.muted },
  empty: { alignItems: "center", padding: 48 },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: color.light.ink, marginBottom: 4 },
  emptyDesc: { fontSize: 12.5, color: color.light.muted, textAlign: "center" },
});
