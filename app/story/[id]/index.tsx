import { useState, useEffect } from "react";
import { View, Pressable, ScrollView, StyleSheet, Image } from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Bookmark, Share2 } from "lucide-react-native";
import { color, radius } from "@/lib/tokens";
import { supabase } from "@/lib/supabase";
import { getTodayStories } from "@/lib/queries";
import { Story } from "@/lib/types";
import { storyImages } from "@/lib/storyImages";
import { StoryThumbnail } from "@/components/StoryThumbnail";
import { getSavedIds, toggleSavedId } from "@/lib/savedStories";
import { getStoredZip } from "@/lib/onboarding";

const DEFAULT_ZIP = "20814";

export default function StoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [mode, setMode] = useState<"everyday" | "deeper">("everyday");
  const [saved, setSaved] = useState(false);
  const [story, setStory] = useState<Story | null>(null);

  useEffect(() => {
    getStoredZip().then((stored) => {
      const zip = stored && stored.length === 5 ? stored : DEFAULT_ZIP;
      getTodayStories(supabase, zip).then((all) => {
        setStory(all.find((s) => s.id === id) ?? null);
      });
    });
    if (id) getSavedIds().then((ids) => setSaved(ids.includes(id)));
  }, [id]);

  if (!story) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ padding: 20, color: color.light.muted }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  const image = storyImages[story.id];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.appbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={24} color={color.light.ink} />
        </Pressable>
        <Text style={styles.appbarTitle}>Story</Text>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <Pressable onPress={async () => { const next = await toggleSavedId(story.id); setSaved(next.includes(story.id)); }} hitSlop={8}>
            <Bookmark size={20} color={saved ? color.brand.deepTeal : color.light.ink} fill={saved ? color.brand.deepTeal : "none"} />
          </Pressable>
          <Share2 size={20} color={color.light.ink} />
        </View>
      </View>

      <ScrollView>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>
            {story.scope.toUpperCase()} · updated {story.updated}
          </Text>
          <Text style={styles.heroTitle}>{story.headline}</Text>
          {image ? (
            <Image source={image} style={styles.heroImage} />
          ) : (
            <View style={styles.heroImage}>
              <StoryThumbnail scope={story.scope} size={100} />
            </View>
          )}
          <Text style={styles.byline}>Politick Editorial Desk</Text>
        </View>

        <View style={styles.segmented}>
          {(["everyday", "deeper"] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={[styles.segmentBtn, mode === m && styles.segmentBtnActive]}>
              <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>{m === "everyday" ? "Everyday" : "Go Deeper"}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ padding: 20 }}>
          {mode === "everyday" ? (
            <>
              <Section label="What happened">{story.whatHappened}</Section>
              <Section label="Why it matters">{story.whyItMatters}</Section>
              <Section label="Who is involved">
                {`Sponsored by ${story.storyMap.sponsor}. ${story.storyMap.cosponsors}.`}
              </Section>
              <Section label="What happens next">{story.storyMap.nextCheckpoint}</Section>
              <View style={styles.relevance}>
                <Text style={styles.relevanceText}>
                  <Text style={{ fontWeight: "700" }}>Your connection. </Text>
                  {story.zipNote}
                </Text>
              </View>
              <Section label="What is uncertain">
                Not yet assessed — this analysis hasn't been completed for this story yet.
              </Section>
              <Pressable onPress={() => router.push(`/story/${story.id}/sources`)}>
                <Text style={styles.sourcesLink}>View sources ({story.sources.length}) →</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.keyDetails}>
                <KeyRow label="Status" value={story.storyMap.status} />
                <KeyRow label="Sponsor" value={story.storyMap.sponsor} />
                <KeyRow label="Support" value={story.storyMap.cosponsors} />
                <KeyRow label="Next checkpoint" value={story.storyMap.nextCheckpoint} />
                <KeyRow label="Fiscal note" value={story.storyMap.fiscalNote} />
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

function KeyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.keyRow}>
      <Text style={styles.keyLabel}>{label}</Text>
      <Text style={styles.keyValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.light.canvas },
  appbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 56, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: color.light.border, backgroundColor: color.light.surface },
  appbarTitle: { fontSize: 14, fontWeight: "700", color: color.light.ink },
  hero: { padding: 20, borderBottomWidth: 1, borderBottomColor: color.light.border },
  heroEyebrow: { fontSize: 11, fontWeight: "800", color: color.brand.deepTeal, marginBottom: 8 },
  heroTitle: { fontSize: 24, lineHeight: 30, fontWeight: "800", color: color.light.ink, marginBottom: 12 },
  heroImage: { width: "100%", height: 160, borderRadius: 14, marginBottom: 12, backgroundColor: color.brand.softTeal, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  byline: { fontSize: 11, color: color.light.muted },
  segmented: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: color.light.border },
  segmentBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  segmentBtnActive: { borderBottomColor: color.brand.signalGold },
  segmentText: { fontSize: 13.5, fontWeight: "700", color: color.light.muted },
  segmentTextActive: { color: color.brand.deepTeal },
  section: { backgroundColor: color.light.surface, borderWidth: 1, borderColor: color.light.border, borderRadius: radius.card, padding: 16, marginBottom: 12 },
  sectionLabel: { fontSize: 10.5, fontWeight: "800", color: color.brand.deepTeal, letterSpacing: 0.4, marginBottom: 6 },
  sectionBody: { fontSize: 14.5, lineHeight: 21, color: color.light.ink },
  relevance: { backgroundColor: color.brand.warmSand, borderRadius: 12, padding: 14, marginBottom: 14 },
  relevanceText: { fontSize: 13.5, lineHeight: 19, color: color.light.ink },
  sourcesLink: { fontSize: 14, fontWeight: "700", color: color.brand.deepTeal },
  keyDetails: { gap: 10 },
  keyRow: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: color.light.border, paddingBottom: 8 },
  keyLabel: { fontSize: 11, color: color.light.muted, flex: 1 },
  keyValue: { fontSize: 13, fontWeight: "600", color: color.light.ink, flex: 1.4, textAlign: "right" },
});
