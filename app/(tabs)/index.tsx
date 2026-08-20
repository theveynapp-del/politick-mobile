import { useState, useEffect, useCallback } from "react";
import { View, ScrollView, StyleSheet, Pressable, Image, ActivityIndicator, useWindowDimensions } from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Bell, MapPin } from "lucide-react-native";
import { color } from "@/lib/tokens";
import { supabase } from "@/lib/supabase";
import { getTodayStories, getRepresentativesByZip, getZipLocation, ZipLocation } from "@/lib/queries";
import { stateForZip } from "@/lib/zipToState";
import { Story, TopicScope, Representative } from "@/lib/types";
import { StoryCard } from "@/components/today/StoryCard";
import { YourReps } from "@/components/today/YourReps";
import { getStoredZip, getStoredName } from "@/lib/onboarding";
import { getSavedIds, toggleSavedId } from "@/lib/savedStories";

const DEFAULT_ZIP = "20814";
const FILTERS: (TopicScope | "All")[] = ["All", "Local", "State", "Federal", "World"];

function greetingFor(name: string | null) {
  const h = new Date().getHours();
  const base = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  // Onboarding doesn't capture a name, so this is normally null. An
  // unpersonalised greeting is correct — never invent one.
  return name ? `${base}, ${name}.` : `${base}.`;
}

function dateLabel() {
  return new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export default function TodayScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<TopicScope | "All">("All");
  const [name, setName] = useState<string | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [reps, setReps] = useState<Representative[]>([]);
  const [stateName, setStateName] = useState<string | null>(null);
  const [zip, setZip] = useState<string | null>(null);
  const [place, setPlace] = useState<ZipLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const { width } = useWindowDimensions();
  const tight = width <= 380;
  const gutter = tight ? 16 : 20;

  const load = useCallback(async (zipValue: string) => {
    setLoading(true);
    setZip(zipValue);
    setStateName(stateForZip(zipValue));
    getZipLocation(supabase, zipValue).then(setPlace);
    const fresh = await getTodayStories(supabase, zipValue);
    setStories(fresh);
    setLoading(false);
    // Resolving reps can hit the lookup edge function, which is slow on a
    // cold ZIP. Kept off the stories' critical path so the feed isn't held up.
    getRepresentativesByZip(supabase, zipValue).then((resolved) => {
      setReps(resolved);
      // A cold ZIP has no location row until the lookup runs — that call is
      // what creates it, so re-read once it has finished.
      getZipLocation(supabase, zipValue).then((p) => p && setPlace(p));
    });
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

  // Prefer the real place name; a ZIP that hasn't been resolved yet only has
  // the state its prefix implies, which is still better than nothing.
  const placeLabel = place ? `${place.city}, ${place.stateAbbr}` : stateName;
  const locationLabel = [placeLabel, zip].filter(Boolean).join(" · ") || null;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: gutter }}>
          <View style={styles.brandRow}>
            {/* The approved lockup asset, not text — keeps the emblem geometry,
                gold dot and letterforms identical to onboarding rather than
                approximating them with a system font. */}
            <Image
              source={require("@/assets/politick-logo-lockup.png")}
              style={styles.wordmark}
              resizeMode="contain"
              accessibilityLabel="Politick"
            />
            {locationLabel ? (
              <View style={styles.locationPill} accessibilityLabel={`Your location: ${locationLabel}`}>
                <MapPin size={12} color="#5D6670" strokeWidth={2} />
                {/* Two texts, not one: a long city ("Salt Lake City, UT") would
                    otherwise eat the ellipsis and take the ZIP with it. Only the
                    place name shrinks, so the ZIP always stays legible. */}
                {placeLabel ? (
                  <Text style={styles.locationPlace} numberOfLines={1}>
                    {placeLabel}
                  </Text>
                ) : null}
                {placeLabel && zip ? <Text style={styles.locationSep}>·</Text> : null}
                {zip ? <Text style={styles.locationZip}>{zip}</Text> : null}
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <Pressable
              onPress={() => router.push("/you")}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Notification settings"
              style={styles.iconButton}
            >
              <Bell size={24} color="#101418" strokeWidth={1.8} />
            </Pressable>
          </View>

          <View style={styles.greetingBlock}>
            <Text style={styles.greeting} accessibilityRole="header">
              {greetingFor(name)}
            </Text>
            <Text style={styles.date}>{dateLabel()}</Text>
          </View>

          <View style={styles.dailyFive}>
            <Text style={styles.dailyFiveTitle} accessibilityRole="header">
              Your Daily 5
            </Text>
            <View style={styles.dailyFiveRow}>
              <Text style={styles.dailyFiveSupporting}>
                {dailyFive.length} important {dailyFive.length === 1 ? "story" : "stories"}. 5 minutes.
              </Text>
              <Text style={styles.progressStatus}>
                {readCount} of {dailyFive.length} read
              </Text>
            </View>
          </View>

          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: dailyFive.length, now: readCount }}
            accessibilityLabel={`${readCount} of ${dailyFive.length} stories read`}
          >
            <View style={[styles.progressValue, { width: `${progressPct}%` }]} />
          </View>

          <View style={[styles.filters, tight && styles.filtersTight]}>
            {FILTERS.map((f) => {
              const selected = filter === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.chip, tight && styles.chipTight, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{f}</Text>
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
                <StoryCard
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

        {/* Outside the gutter wrapper: the strip scrolls edge to edge, with the
            gutter applied to its content instead. */}
        <YourReps reps={reps} stateName={stateName} gutter={gutter} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.light.canvas },
  // Clears the fixed bottom tab bar so the reps strip is never stranded behind it.
  scrollArea: { paddingBottom: 96 },

  brandRow: { flexDirection: "row", alignItems: "center", columnGap: 10, paddingTop: 12 },
  // 112x32 keeps the lockup's 1000:287 aspect ratio. Smaller than before so the
  // location pill fits the header row at 375 without either being truncated;
  // it also matches the lockup's share of width in the reference.
  wordmark: { width: 112, height: 32 },
  // Keeps the spec's 44px touch target while alignItems lands the 24px glyph on
  // the gutter. The 20px of slack that leaves to the glyph's left read as a gap
  // from the pill, so the box is pulled back over it — the pill isn't
  // interactive, so the overlap costs nothing.
  iconButton: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "center", marginLeft: -18 },

  locationPill: {
    // Pushed right so it sits beside the bell rather than trailing the lockup.
    marginLeft: "auto",
    flexShrink: 1,
    height: 26,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    backgroundColor: "#FFFFFF",
  },
  locationPlace: { flexShrink: 1, fontSize: 11, lineHeight: 14, fontWeight: "500", color: "#41484F" },
  locationSep: { fontSize: 11, lineHeight: 14, fontWeight: "500", color: "#8A929A" },
  locationZip: { flexShrink: 0, fontSize: 11, lineHeight: 14, fontWeight: "500", color: "#41484F" },

  greetingBlock: { marginTop: 18 },
  greeting: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: -0.35, color: "#101418" },
  date: { marginTop: 3, fontSize: 13.5, lineHeight: 18, fontWeight: "400", color: "#5D6670" },

  dailyFive: { marginTop: 26 },
  dailyFiveTitle: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: -0.4, color: "#101418" },
  dailyFiveRow: { marginTop: 3, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  dailyFiveSupporting: { flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 19, fontWeight: "500", color: "#252B30" },
  progressStatus: { fontSize: 13, lineHeight: 18, fontWeight: "600", color: "#252B30" },

  progressTrack: { marginTop: 12, height: 6, borderRadius: 999, overflow: "hidden", backgroundColor: "#E6E3DC" },
  progressValue: { height: "100%", borderRadius: 999, backgroundColor: "#167D79" },

  filters: { marginTop: 16, flexDirection: "row", gap: 8 },
  filtersTight: { gap: 6 },
  chip: {
    height: 34,
    // Spec asks for 15-17px padding *and* all five chips on one row at 390px.
    // Those don't hold together: at 15px they overrun the 350px content width
    // and "World" clips. One row is the stated acceptance criterion, so the
    // padding gives way.
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  chipTight: { paddingHorizontal: 10 },
  chipSelected: { backgroundColor: "#0D5F5B", borderColor: "#0D5F5B" },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: "600", color: "#252B30" },
  chipTextSelected: { color: "#FFFFFF" },

  storyList: { marginTop: 16, gap: 10 },
  emptyText: { textAlign: "center", color: "#5D6670", fontSize: 13.5, padding: 48 },
});
