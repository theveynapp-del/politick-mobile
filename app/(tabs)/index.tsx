import { useState, useEffect, useCallback } from "react";
import { View, FlatList, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell } from "lucide-react-native";
import { color, radius } from "@/lib/tokens";
import { supabase } from "@/lib/supabase";
import { getTodayStories } from "@/lib/queries";
import { Story, TopicScope } from "@/lib/types";
import { StoryCard } from "@/components/StoryCard";
import { Wordmark } from "@/components/Wordmark";
import { getStoredZip } from "@/lib/onboarding";
import { getSavedIds, toggleSavedId } from "@/lib/savedStories";

const DEFAULT_ZIP = "20814";
const FILTERS: (TopicScope | "All")[] = ["All", "Local", "State", "Federal", "World"];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning.";
  if (h < 18) return "Good afternoon.";
  return "Good evening.";
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export default function TodayScreen() {
  const [filter, setFilter] = useState<TopicScope | "All">("All");
  const [zip, setZip] = useState(DEFAULT_ZIP);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const load = useCallback(async (zipValue: string) => {
    setLoading(true);
    const fresh = await getTodayStories(supabase, zipValue);
    setStories(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Prefer the ZIP the user actually entered during onboarding over the
    // hardcoded fallback, without blocking first paint on the lookup.
    getStoredZip().then((stored) => {
      const initialZip = stored && stored.length === 5 ? stored : DEFAULT_ZIP;
      if (initialZip !== DEFAULT_ZIP) setZip(initialZip);
      load(initialZip);
    });
    getSavedIds().then((ids) => setSaved(Object.fromEntries(ids.map((id) => [id, true]))));
  }, [load]);

  const visible = filter === "All" ? stories : stories.filter((s) => s.scope === filter);
  const dailyFive = visible.slice(0, 5);
  const moreToday = visible.slice(5);
  const readCount = dailyFive.filter((s) => saved[s.id]).length;
  const progressPct = dailyFive.length ? (readCount / dailyFive.length) * 100 : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        {/* Top app bar: wordmark left, notification bell right — per guide's
            Global Shell spec, this is a distinct row from the greeting. */}
        <View style={styles.appBar}>
          <Wordmark />
          <Pressable hitSlop={8}>
            <Bell size={19} color={color.light.muted} />
          </Pressable>
        </View>

        {/* Greeting and date appear before "Your Daily 5" per the guide. */}
        <Text style={styles.greeting}>{greeting()}</Text>
        <Text style={styles.dateLabel}>{todayLabel()}</Text>

        <View style={styles.dailyFiveRow}>
          <Text style={styles.dailyFive}>Your Daily 5</Text>
          <View style={styles.dailyMetaRow}>
            <Text style={styles.dailyMeta}>
              {dailyFive.length} important {dailyFive.length === 1 ? "story" : "stories"}. 5 minutes.
            </Text>
            <Text style={styles.progressLabel}>{readCount} of {dailyFive.length} read</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>

        <View style={styles.chipRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.chip, filter === f && styles.chipSelected]}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextSelected]}>{f}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={dailyFive}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <StoryCard
            story={item}
            saved={!!saved[item.id]}
            onToggleSave={async () => {
              const next = await toggleSavedId(item.id);
              setSaved(Object.fromEntries(next.map((id) => [id, true])));
            }}
          />
        )}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>No stories in this category yet — check back soon.</Text>
          ) : (
            <ActivityIndicator style={{ marginTop: 40 }} color={color.brand.deepTeal} />
          )
        }
        ListFooterComponent={
          <>
            {moreToday.length > 0 && (
              <>
                <Text style={styles.moreLabel}>MORE TODAY</Text>
                {moreToday.map((item) => (
                  <StoryCard
                    key={item.id}
                    story={item}
                    saved={!!saved[item.id]}
                    onToggleSave={async () => {
                      const next = await toggleSavedId(item.id);
                      setSaved(Object.fromEntries(next.map((id) => [id, true])));
                    }}
                  />
                ))}
              </>
            )}
            {visible.length > 0 && <Text style={styles.footerText}>You&rsquo;re caught up for today.</Text>}
          </>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.light.canvas },
  header: { paddingHorizontal: 20, paddingTop: 4 },
  appBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44, marginBottom: 14 },
  greeting: { fontSize: 20, fontWeight: "700", color: color.light.ink },
  dateLabel: { fontSize: 12.5, color: color.light.muted, marginTop: 2, marginBottom: 18 },
  dailyFiveRow: { marginBottom: 10 },
  dailyFive: { fontSize: 22, fontWeight: "800", color: color.light.ink, letterSpacing: -0.3 },
  dailyMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 2 },
  dailyMeta: { fontSize: 12.5, color: color.light.muted },
  progressTrack: { height: 6, backgroundColor: color.light.border, borderRadius: 3, overflow: "hidden", marginBottom: 14 },
  progressFill: { height: "100%", backgroundColor: color.brand.civicTeal, borderRadius: 3 },
  progressLabel: { fontSize: 11, color: color.light.muted, fontWeight: "600" },
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  chip: { borderWidth: 1, borderColor: color.light.border, borderRadius: radius.chip, paddingVertical: 9, paddingHorizontal: 16, backgroundColor: color.light.surface, minHeight: 34, justifyContent: "center" },
  chipSelected: { backgroundColor: color.brand.deepTeal, borderColor: color.brand.deepTeal },
  chipText: { fontSize: 12.5, fontWeight: "600", color: color.light.muted },
  chipTextSelected: { color: "#fff" },
  moreLabel: { fontSize: 11, fontWeight: "700", color: color.light.muted, letterSpacing: 0.5, marginLeft: 20, marginTop: 6, marginBottom: 10 },
  emptyText: { textAlign: "center", color: color.light.muted, fontSize: 13.5, padding: 48 },
  footerText: { textAlign: "center", color: color.light.muted, fontSize: 12, paddingVertical: 16 },
});
