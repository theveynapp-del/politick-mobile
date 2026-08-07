import { useState, useEffect } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Search, Sparkles, ChevronRight } from "lucide-react-native";
import { color } from "@/lib/tokens";
import { supabase } from "@/lib/supabase";
import { getTodayStories } from "@/lib/queries";
import { getStoredZip } from "@/lib/onboarding";
import { Story } from "@/lib/types";
import { estimateReadMinutes } from "@/lib/readTime";
import { searchExplore, ExploreSearchResult } from "@/lib/exploreSearch";

const TOPICS = ["Economy", "Housing", "Healthcare", "Tax Policy", "Immigration", "Energy"];
const DEFAULT_ZIP = "20814";

export default function ExploreScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [worldStories, setWorldStories] = useState<Story[]>([]);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<ExploreSearchResult | null>(null);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);

  const { width } = useWindowDimensions();
  const tight = width <= 380;

  useEffect(() => {
    getStoredZip().then((stored) =>
      getTodayStories(supabase, stored && stored.length === 5 ? stored : DEFAULT_ZIP).then((all) =>
        setWorldStories(all.filter((s) => s.scope === "World"))
      )
    );
  }, []);

  const runSearch = async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    setActiveQuery(q);
    setResult(null);
    setResult(await searchExplore(supabase, q));
    setSearching(false);
  };

  const clearSearch = () => {
    setQuery("");
    setActiveQuery(null);
    setResult(null);
  };

  // The reference shows a fixed "Trade talks" headline; this uses the newest
  // real World story instead, and says so honestly when there isn't one.
  const featured = worldStories[0] ?? null;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollArea} keyboardShouldPersistTaps="handled">
        <View style={[styles.header, tight && styles.gutterTight]}>
          <Text style={styles.title}>Explore</Text>

          <View style={styles.searchField}>
            <Search size={19} color="#8A929A" strokeWidth={1.75} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a topic or bill"
              placeholderTextColor="#8A929A"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => runSearch(query)}
              returnKeyType="search"
              accessibilityLabel="Search for a topic or bill"
            />
          </View>
        </View>

        <View style={[styles.divider, tight && styles.dividerTight]} />

        <View style={[styles.section, styles.topicsSection, tight && styles.gutterTight]}>
          <Text style={styles.sectionHeading}>Top topics</Text>
          <View style={[styles.topicGrid, tight && styles.topicGridTight]}>
            {TOPICS.map((t) => (
              <Pressable
                key={t}
                onPress={() => {
                  setQuery(t);
                  runSearch(t);
                }}
                accessibilityRole="button"
                accessibilityLabel={t}
                style={({ pressed }) => [
                  styles.topicChip,
                  tight && styles.topicChipTight,
                  pressed && styles.topicChipPressed,
                ]}
              >
                <Text style={[styles.topicChipText, tight && styles.topicChipTextTight]}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {(searching || result) && (
          <View style={[styles.section, tight && styles.gutterTight, { marginTop: 22 }]}>
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Sparkles size={14} color={color.brand.deepTeal} />
                <Text style={styles.resultHeaderText}>
                  {activeQuery ? `About "${activeQuery}"` : "Answer"}
                </Text>
                <Pressable onPress={clearSearch} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              </View>

              {searching ? (
                <ActivityIndicator color={color.brand.deepTeal} style={{ marginVertical: 16 }} />
              ) : result?.found ? (
                <Text style={styles.resultText}>{result.answer}</Text>
              ) : (
                <Text style={styles.resultEmptyText}>
                  {result?.message ?? result?.error ?? "Something went wrong — try again in a moment."}
                </Text>
              )}
            </View>
          </View>
        )}

        <View style={[styles.section, styles.worldSection, tight && styles.gutterTight]}>
          <Text style={styles.sectionHeading}>Around the world</Text>

          <Pressable
            style={styles.worldModule}
            accessibilityRole="link"
            accessibilityLabel={featured ? featured.headline : "World coverage"}
            disabled={!featured}
            onPress={() => featured && router.push(`/story/${featured.id}`)}
          >
            <Image
              source={require("@/assets/explore/world-map.jpg")}
              style={[styles.worldMap, tight && styles.worldMapTight]}
              resizeMode="cover"
              accessibilityLabel="World map highlighting current international stories"
            />

            <View style={styles.worldStoryContent}>
              {featured ? (
                <>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.worldMetadata}>
                      {featured.scope.toUpperCase()} · {estimateReadMinutes(featured)} MIN READ
                    </Text>
                    <Text style={styles.worldHeadline} numberOfLines={2}>
                      {featured.headline}
                    </Text>
                  </View>
                  <ChevronRight size={21} color="#5D6670" strokeWidth={1.8} />
                </>
              ) : (
                <Text style={styles.emptyWorldText}>No world coverage available right now.</Text>
              )}
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.light.canvas },
  // Clears the fixed tab bar so the world module is never stranded behind it.
  scrollArea: { paddingBottom: 96 },
  gutterTight: { paddingHorizontal: 20 },

  header: { paddingHorizontal: 24, paddingTop: 20 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: -0.5, color: "#101418" },

  searchField: {
    marginTop: 18,
    height: 46,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    backgroundColor: "#EEE9DE",
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 20, fontWeight: "400", color: "#101418" },

  divider: { height: 1, marginTop: 19, marginHorizontal: 24, backgroundColor: "#E3E0D8" },
  dividerTight: { marginHorizontal: 20 },

  section: { paddingHorizontal: 24 },
  sectionHeading: { fontSize: 20, lineHeight: 26, fontWeight: "700", letterSpacing: -0.25, color: "#101418" },

  topicsSection: { marginTop: 22 },
  topicGrid: { marginTop: 15, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  topicGridTight: { gap: 8 },
  topicChip: {
    height: 40,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: "#EEE9DE",
    alignItems: "center",
    justifyContent: "center",
  },
  topicChipTight: { paddingHorizontal: 13 },
  topicChipPressed: { backgroundColor: color.brand.softTeal },
  topicChipText: { fontSize: 14, lineHeight: 18, fontWeight: "600", color: "#252B30" },
  topicChipTextTight: { fontSize: 13 },

  resultCard: { backgroundColor: color.brand.warmSand, borderRadius: 14, padding: 16 },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  resultHeaderText: { flex: 1, fontSize: 11, fontWeight: "700", color: color.brand.deepTeal, textTransform: "uppercase", letterSpacing: 0.3 },
  clearText: { fontSize: 11.5, fontWeight: "600", color: color.light.muted },
  resultText: { fontSize: 14.5, lineHeight: 21, color: color.light.ink },
  resultEmptyText: { fontSize: 13.5, lineHeight: 19, color: color.light.muted },

  worldSection: { marginTop: 36 },
  // Map and story share one bordered container so they read as a single module.
  worldModule: {
    marginTop: 15,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#DDE1E5",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  worldMap: { width: "100%", height: 218, backgroundColor: "#F2EFE7" },
  worldMapTight: { height: 204 },
  worldStoryContent: {
    minHeight: 104,
    paddingVertical: 14,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    backgroundColor: "#FFFFFF",
  },
  worldMetadata: { fontSize: 11, lineHeight: 15, fontWeight: "600", letterSpacing: 0.3, color: "#5D6670" },
  worldHeadline: { marginTop: 8, fontSize: 17, lineHeight: 23, fontWeight: "700", letterSpacing: -0.15, color: "#101418" },
  emptyWorldText: { flex: 1, fontSize: 14, lineHeight: 20, color: "#5D6670" },
});
