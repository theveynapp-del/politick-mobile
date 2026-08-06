import { useState, useEffect } from "react";
import { View, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, Sparkles } from "lucide-react-native";
import { color, radius } from "@/lib/tokens";
import { supabase } from "@/lib/supabase";
import { getTodayStories } from "@/lib/queries";
import { Story } from "@/lib/types";
import { StoryCard } from "@/components/StoryCard";
import { WorldMapIllustration } from "@/components/WorldMapIllustration";
import { getSavedIds, toggleSavedId } from "@/lib/savedStories";
import { searchExplore, ExploreSearchResult } from "@/lib/exploreSearch";

const TOPICS = ["Economy", "Housing", "Healthcare", "Tax Policy", "Immigration", "Energy"];

export default function ExploreScreen() {
  const [query, setQuery] = useState("");
  const [worldStories, setWorldStories] = useState<Story[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<ExploreSearchResult | null>(null);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);

  useEffect(() => {
    getTodayStories(supabase, "20814").then((all) => setWorldStories(all.filter((s) => s.scope === "World")));
    getSavedIds().then(setSavedIds);
  }, []);

  const runSearch = async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    setActiveQuery(q);
    setResult(null);
    const res = await searchExplore(supabase, q);
    setResult(res);
    setSearching(false);
  };

  const clearSearch = () => {
    setQuery("");
    setActiveQuery(null);
    setResult(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Explore</Text>

        <View style={styles.searchBox}>
          <Search size={15} color={color.light.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Ask about a topic or bill"
            placeholderTextColor={color.light.muted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => runSearch(query)}
            returnKeyType="search"
          />
        </View>

        <Text style={styles.sectionLabel}>Top topics</Text>
        <View style={styles.chipsWrap}>
          {TOPICS.map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                setQuery(t);
                runSearch(t);
              }}
              style={[styles.chip, activeQuery === t && styles.chipActive]}
            >
              <Text style={[styles.chipText, activeQuery === t && styles.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {(searching || result) && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Sparkles size={14} color={color.brand.deepTeal} />
              <Text style={styles.resultHeaderText}>
                {activeQuery ? `About "${activeQuery}"` : "Answer"}
              </Text>
              <Pressable onPress={clearSearch} hitSlop={8}>
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            </View>

            {searching ? (
              <ActivityIndicator color={color.brand.deepTeal} style={{ marginVertical: 16 }} />
            ) : result?.found ? (
              <Text style={styles.resultText}>{result.answer}</Text>
            ) : (
              <Text style={styles.resultEmptyText}>
                {result?.message ?? result?.error ?? "Something went wrong \u2014 try again in a moment."}
              </Text>
            )}
          </View>
        )}

        <Text style={styles.sectionLabel}>Around the world</Text>
        <View style={styles.mapCard}>
          <WorldMapIllustration />
        </View>

        {worldStories.length > 0 ? (
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
        ) : (
          <Text style={styles.emptyWorldText}>World coverage is coming soon.</Text>
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
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  chip: { borderWidth: 1, borderColor: color.light.border, backgroundColor: color.light.surface, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipActive: { backgroundColor: color.brand.softTeal, borderColor: color.brand.civicTeal },
  chipText: { fontSize: 12.5, fontWeight: "600", color: color.light.muted },
  chipTextActive: { color: color.brand.deepTeal, fontWeight: "700" },
  resultCard: { backgroundColor: color.brand.warmSand, borderRadius: radius.card, padding: 16, marginBottom: 24 },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  resultHeaderText: { flex: 1, fontSize: 11, fontWeight: "700", color: color.brand.deepTeal, textTransform: "uppercase", letterSpacing: 0.3 },
  clearText: { fontSize: 11.5, fontWeight: "600", color: color.light.muted },
  resultText: { fontSize: 14.5, lineHeight: 21, color: color.light.ink },
  resultEmptyText: { fontSize: 13.5, lineHeight: 19, color: color.light.muted },
  mapCard: { borderRadius: 14, marginBottom: 16, overflow: "hidden" },
  emptyWorldText: { fontSize: 13, color: color.light.muted, textAlign: "center", paddingVertical: 20 },
});
