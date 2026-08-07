import { useState, useEffect, useCallback } from "react";
import { View, ScrollView, StyleSheet, Pressable, Image, ActivityIndicator, useWindowDimensions } from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Bell, Bookmark } from "lucide-react-native";
import { color } from "@/lib/tokens";
import { supabase } from "@/lib/supabase";
import { getTodayStories } from "@/lib/queries";
import { Story, TopicScope } from "@/lib/types";
import { StoryPlaceholder } from "@/components/StoryPlaceholder";
import { topicImageFor } from "@/lib/topicImages";
import { estimateReadMinutes } from "@/lib/readTime";
import { getStoredZip, getStoredName } from "@/lib/onboarding";
import { getSavedIds, toggleSavedId } from "@/lib/savedStories";

const DEFAULT_ZIP = "20814";
const FILTERS: (TopicScope | "All")[] = ["All", "Local", "State", "Federal", "World"];

function greetingFor(name: string | null) {
  const h = new Date().getHours();
  const base = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${base}, ${name}.` : `${base}.`;
}

function dateLabel() {
  return new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

/**
 * Feed card, scoped to this screen. The shared StoryCard is still used by
 * Saved and Explore, which haven't been through a fidelity pass yet —
 * restyling it here would silently change those screens too.
 */
function TodayStoryCard({
  story,
  saved,
  onToggleSave,
  tight,
}: {
  story: Story;
  saved: boolean;
  onToggleSave: () => void;
  tight: boolean;
}) {
  const router = useRouter();
  const imageSize = tight ? 96 : 105;

  // Three tiers, most specific first: the story's own photograph, then a
  // real photo for its topic, then the Politick placeholder — which reads as
  // branding rather than pretending to be a photograph of anything.
  const [remoteFailed, setRemoteFailed] = useState(false);
  const remote = !remoteFailed && story.imageUrl ? story.imageUrl : null;
  const topical = remote ? null : topicImageFor(story.topic);

  return (
    <Pressable
      onPress={() => router.push(`/story/${story.id}`)}
      style={[styles.storyCard, tight && styles.storyCardTight]}
      // "link", not "button": the card contains its own bookmark button, and
      // RN Web renders role=button as a real <button>, which cannot legally
      // nest another one.
      accessibilityRole="link"
      accessibilityLabel={story.headline}
    >
      <View style={styles.storyTopRow}>
        <Text style={styles.storyMetadata}>
          {story.scope.toUpperCase()} · {estimateReadMinutes(story)} min read
        </Text>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onToggleSave();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityState={{ selected: saved }}
          accessibilityLabel={saved ? `Remove ${story.headline} from saved` : `Save ${story.headline}`}
          style={styles.bookmarkButton}
        >
          <Bookmark
            size={23}
            color="#252B30"
            strokeWidth={1.8}
            fill={saved ? "#252B30" : "none"}
          />
        </Pressable>
      </View>

      <View style={styles.storyContent}>
        <View style={styles.storyText}>
          <Text style={styles.storyHeadline}>{story.headline}</Text>
          <Text style={styles.storySummary} numberOfLines={3}>
            {story.whatHappened}
          </Text>
        </View>

        {remote ? (
          <Image
            source={{ uri: remote }}
            style={[styles.storyImage, { width: imageSize, height: imageSize }]}
            onError={() => setRemoteFailed(true)}
            accessibilityLabel={`Photograph accompanying: ${story.headline}`}
          />
        ) : topical ? (
          <Image
            source={topical}
            style={[styles.storyImage, { width: imageSize, height: imageSize }]}
            accessibilityLabel={`${story.topic} — illustrative photograph`}
          />
        ) : (
          <StoryPlaceholder style={[styles.storyImage, { width: imageSize, height: imageSize }]} />
        )}
      </View>
    </Pressable>
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<TopicScope | "All">("All");
  const [name, setName] = useState<string | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const { width } = useWindowDimensions();
  const tight = width <= 380;

  const load = useCallback(async (zipValue: string) => {
    setLoading(true);
    const fresh = await getTodayStories(supabase, zipValue);
    setStories(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    getStoredZip().then((stored) => load(stored && stored.length === 5 ? stored : DEFAULT_ZIP));
    getSavedIds().then((ids) => setSaved(Object.fromEntries(ids.map((id) => [id, true]))));
    getStoredName().then(setName);
  }, [load]);

  const visible = filter === "All" ? stories : stories.filter((s) => s.scope === filter);
  const dailyFive = visible.slice(0, 5);
  const readCount = dailyFive.filter((s) => saved[s.id]).length;
  const progressPct = dailyFive.length ? (readCount / dailyFive.length) * 100 : 0;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollArea}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, tight && styles.gutterTight]}>
          <View style={styles.brandRow}>
            {/* The approved lockup asset, not text — keeps the emblem
                geometry, gold dots and letterforms identical to onboarding
                rather than approximating them with a system font. */}
            <Image
              source={require("@/assets/politick-logo-lockup.png")}
              style={styles.wordmark}
              resizeMode="contain"
              accessibilityLabel="Politick"
            />
            <Pressable
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Open notifications"
              style={styles.iconButton}
            >
              <Bell size={24} color="#101418" strokeWidth={1.8} />
            </Pressable>
          </View>

          <View style={styles.greetingBlock}>
            <Text style={styles.greeting}>{greetingFor(name)}</Text>
            <Text style={styles.date}>{dateLabel()}</Text>
          </View>
        </View>

        <View style={[styles.dailyFiveSection, tight && styles.gutterTight]}>
          <View style={styles.dailyFiveHeadingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dailyFiveTitle}>Your Daily 5</Text>
              <Text style={styles.dailyFiveSupporting}>
                {dailyFive.length} important {dailyFive.length === 1 ? "story" : "stories"}. 5 minutes.
              </Text>
            </View>
            <Text style={styles.progressStatus}>
              {readCount} of {dailyFive.length} read
            </Text>
          </View>

          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: dailyFive.length, now: readCount }}
            accessibilityLabel={`${readCount} of ${dailyFive.length} stories read`}
          >
            <View style={[styles.progressValue, { width: `${progressPct}%` }]} />
          </View>

          <View style={[styles.topicFilters, tight && styles.topicFiltersTight]}>
            {FILTERS.map((f) => {
              const selected = filter === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.topicChip, tight && styles.topicChipTight, selected && styles.topicChipSelected]}
                >
                  <Text style={[styles.topicChipText, selected && styles.topicChipTextSelected]}>{f}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.storyList}>
            {loading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={color.brand.deepTeal} />
            ) : dailyFive.length === 0 ? (
              <Text style={styles.emptyText}>No stories in this category yet — check back soon.</Text>
            ) : (
              dailyFive.map((story) => (
                <TodayStoryCard
                  key={story.id}
                  story={story}
                  tight={tight}
                  saved={!!saved[story.id]}
                  onToggleSave={async () => {
                    const next = await toggleSavedId(story.id);
                    setSaved(Object.fromEntries(next.map((id) => [id, true])));
                  }}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.light.canvas },
  // Clears the fixed bottom tab bar so the last card is never stranded behind it.
  scrollArea: { paddingBottom: 96 },
  gutterTight: { paddingHorizontal: 20 },

  header: { paddingHorizontal: 24, paddingTop: 18 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  // 132x38 preserves the lockup's 1000:287 aspect ratio at roughly the 36px
  // cap-height the spec calls for.
  wordmark: { width: 132, height: 38 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },

  greetingBlock: { marginTop: 24 },
  greeting: { fontSize: 20, lineHeight: 26, fontWeight: "600", letterSpacing: -0.2, color: "#101418" },
  date: { marginTop: 3, fontSize: 13, lineHeight: 18, fontWeight: "400", color: "#5D6670" },

  dailyFiveSection: { paddingHorizontal: 24, paddingTop: 26 },
  dailyFiveHeadingRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16 },
  dailyFiveTitle: { fontSize: 24, lineHeight: 30, fontWeight: "700", letterSpacing: -0.4, color: "#101418" },
  dailyFiveSupporting: { marginTop: 4, fontSize: 14, lineHeight: 20, fontWeight: "500", color: "#252B30" },
  progressStatus: { paddingBottom: 1, fontSize: 14, lineHeight: 20, fontWeight: "600", color: "#252B30" },

  progressTrack: { marginTop: 13, height: 7, borderRadius: 999, overflow: "hidden", backgroundColor: "#E6E3DC" },
  progressValue: { height: "100%", borderRadius: 999, backgroundColor: "#167D79" },

  topicFilters: { marginTop: 23, flexDirection: "row", gap: 10 },
  topicFiltersTight: { gap: 8 },
  topicChip: {
    height: 42,
    // Spec asks for 16-18px padding *and* all five chips on one row at 390px,
    // which don't hold together: at 16px they measure 379px inside a 342px
    // gutter and clip "World". Fitting on one row is the acceptance criterion,
    // so the padding gives way.
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#EEE9DE",
    alignItems: "center",
    justifyContent: "center",
  },
  topicChipTight: { paddingHorizontal: 10 },
  topicChipSelected: { backgroundColor: "#0D5F5B" },
  topicChipText: { fontSize: 14, lineHeight: 18, fontWeight: "600", color: "#252B30" },
  topicChipTextSelected: { color: "#FFFFFF" },

  storyList: { marginTop: 24, gap: 15 },
  storyCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    shadowColor: "#101418",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  storyCardTight: { padding: 14 },
  storyTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  storyMetadata: { fontSize: 11, lineHeight: 15, fontWeight: "600", letterSpacing: 0.3, color: "#5D6670" },
  bookmarkButton: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "flex-start", marginTop: -8, marginRight: -6 },

  storyContent: { marginTop: 8, flexDirection: "row", alignItems: "flex-end", columnGap: 14 },
  storyText: { flex: 1, minWidth: 0 },
  storyHeadline: { fontSize: 18, lineHeight: 24, fontWeight: "700", letterSpacing: -0.2, color: "#101418" },
  storySummary: { marginTop: 12, fontSize: 14, lineHeight: 20, fontWeight: "400", color: "#252B30" },
  storyImage: { borderRadius: 12, backgroundColor: color.brand.softTeal },

  emptyText: { textAlign: "center", color: "#5D6670", fontSize: 13.5, padding: 48 },
});
