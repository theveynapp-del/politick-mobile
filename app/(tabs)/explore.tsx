import { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search } from "lucide-react-native";
import { color, radius } from "@/lib/tokens";
import { supabase } from "@/lib/supabase";
import { getTodayStories } from "@/lib/queries";
import { Story } from "@/lib/types";
import { StoryCard } from "@/components/StoryCard";
import { getSavedIds, toggleSavedId } from "@/lib/savedStories";

const TOPICS = ["Economy", "Housing", "Healthcare", "Tax Policy", "Immigration", "Energy"];

export default function ExploreScreen() {
  const [query, setQuery] = useState("");
  const [worldStories, setWorldStories] = useState<Story[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    getTodayStories(supabase, "20814").then((all) => setWorldStories(all.filter((s) => s.scope === "World")));
    getSavedIds().then(setSavedIds);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.title}>Explore</Text>

        <View style={styles.searchBox}>
          <Search size={15} color={color.light.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a topic or bill"
            placeholderTextColor={color.light.muted}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <Text style={styles.sectionLabel}>Top topics</Text>
        <View style={styles.chipsWrap}>
          {TOPICS.map((t) => (
            <View key={t} style={styles.chip}>
              <Text style={styles.chipText}>{t}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Around the world</Text>
        <View style={styles.mapCard}>
          <Text style={styles.mapCardText}>World map — muted geography, one active highlight color</Text>
        </View>

        {worldStories.length > 0 && (
          <View style={{ marginHorizontal: -20, marginTop: -4 }}>
            {worldStories.slice(0, 1).map((s) => (
              <StoryCard
                key={s.id}
                story={s}
                saved={savedIds.includes(s.id)}
                onToggleSave={async () => setSavedIds(await toggleSavedId(s.id))}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.light.canvas },
  title: { fontSize: 20, fontWeight: "700", color: color.light.ink, marginBottom: 16 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, height: 44, borderWidth: 1, borderColor: color.light.border, borderRadius: radius.button, paddingHorizontal: 14, backgroundColor: color.light.surface, marginBottom: 22 },
  searchInput: { flex: 1, fontSize: 14, color: color.light.ink },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: color.light.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  chip: { borderWidth: 1, borderColor: color.light.border, backgroundColor: color.light.surface, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { fontSize: 12.5, fontWeight: "600", color: color.light.muted },
  mapCard: { height: 130, borderRadius: 14, backgroundColor: color.brand.softTeal, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, marginBottom: 16 },
  mapCardText: { fontSize: 11.5, color: color.light.muted, textAlign: "center" },
});
