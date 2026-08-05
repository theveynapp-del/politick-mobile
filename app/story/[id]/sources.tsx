import { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, ExternalLink } from "lucide-react-native";
import { color, radius } from "@/lib/tokens";
import { supabase } from "@/lib/supabase";
import { getTodayStories } from "@/lib/queries";
import { Story } from "@/lib/types";

export default function SourcesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "sources" | "timeline">("sources");
  const [story, setStory] = useState<Story | null>(null);

  useEffect(() => {
    getTodayStories(supabase, "20814").then((all) => setStory(all.find((s) => s.id === id) ?? null));
  }, [id]);

  if (!story) return null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.appbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={24} color={color.light.ink} />
        </Pressable>
        <Text style={styles.appbarTitle}>Sources</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.segmented}>
        {(["overview", "sources", "timeline"] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.segmentBtn, tab === t && styles.segmentBtnActive]}>
            <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {tab === "overview" && <Text style={styles.body}>{story.whatHappened}</Text>}

        {tab === "sources" && (
          <>
            <Text style={styles.h2}>Primary sources</Text>
            <Text style={styles.sub}>Official documents are listed first. Analysis and reporting provide context, not a substitute for the record.</Text>
            {story.sources.map((s) => (
              <View key={s.label} style={styles.sourceRow}>
                <View style={styles.sourceBadge}>
                  <Text style={styles.sourceBadgeText}>{s.type}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sourceTitle}>{s.label}</Text>
                  <Text style={styles.sourceDomain}>{s.domain}</Text>
                </View>
                <ExternalLink size={14} color={color.light.muted} />
              </View>
            ))}
            <View style={styles.footerNote}>
              <Text style={styles.footerNoteText}>We link to primary sources so you can read for yourself.</Text>
            </View>
          </>
        )}

        {tab === "timeline" && (
          <View style={styles.timeline}>
            <TimelineStep label="Introduced" state="done" />
            <TimelineStep label={story.storyMap.status} state="current" />
            <TimelineStep label="Final action" state="future" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TimelineStep({ label, state }: { label: string; state: "done" | "current" | "future" }) {
  return (
    <View style={styles.timelineStep}>
      <View
        style={[
          styles.timelineDot,
          { borderColor: state === "current" ? color.brand.signalGold : state === "done" ? color.brand.civicTeal : color.light.border },
          state === "done" && { backgroundColor: color.brand.civicTeal },
        ]}
      />
      <Text style={styles.timelineLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.light.canvas },
  appbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 56, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: color.light.border, backgroundColor: color.light.surface },
  appbarTitle: { fontSize: 14, fontWeight: "700", color: color.light.ink },
  segmented: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: color.light.border },
  segmentBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  segmentBtnActive: { borderBottomColor: color.brand.civicTeal },
  segmentText: { fontSize: 13.5, fontWeight: "700", color: color.light.muted },
  segmentTextActive: { color: color.brand.deepTeal },
  body: { fontSize: 14.5, lineHeight: 21, color: color.light.ink },
  h2: { fontSize: 18, fontWeight: "700", color: color.light.ink, marginBottom: 4 },
  sub: { fontSize: 11.5, color: color.light.muted, marginBottom: 16, lineHeight: 16 },
  sourceRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: color.light.border },
  sourceBadge: { backgroundColor: color.brand.softTeal, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  sourceBadgeText: { fontSize: 9, fontWeight: "700", color: color.brand.deepTeal },
  sourceTitle: { fontSize: 13.5, fontWeight: "600", color: color.light.ink },
  sourceDomain: { fontSize: 11, color: color.light.muted, marginTop: 2 },
  footerNote: { backgroundColor: color.brand.warmSand, borderRadius: 12, padding: 14, marginTop: 16 },
  footerNoteText: { fontSize: 13, color: color.light.ink },
  timeline: { borderLeftWidth: 2, borderLeftColor: color.light.border, marginLeft: 6 },
  timelineStep: { paddingVertical: 8, paddingLeft: 18, position: "relative" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, backgroundColor: "#fff", position: "absolute", left: -6, top: 12 },
  timelineLabel: { fontSize: 13.5, color: color.light.ink },
});
