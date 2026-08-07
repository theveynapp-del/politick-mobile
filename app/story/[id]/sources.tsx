import { useState, useEffect } from "react";
import { View, Pressable, ScrollView, StyleSheet, Linking, ActivityIndicator, useWindowDimensions } from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  ExternalLink,
  FileText,
  BarChart3,
  Newspaper,
  LineChart,
  MessageSquareQuote,
} from "lucide-react-native";
import { color } from "@/lib/tokens";
import { supabase } from "@/lib/supabase";
import { getStoryById } from "@/lib/queries";
import { getStoredZip } from "@/lib/onboarding";
import { Story, Source, SourceType } from "@/lib/types";

const DEFAULT_ZIP = "20814";
const TABS = ["Overview", "Sources", "Timeline"] as const;
type Tab = (typeof TABS)[number];

/** Most specific first — the order sources are presented in. */
const TYPE_ORDER: SourceType[] = [
  "Primary source",
  "Official data",
  "Nonpartisan analysis",
  "Reporting",
  "Opinion",
];

const GROUP_HEADINGS: Record<SourceType, string> = {
  "Primary source": "Primary sources",
  "Official data": "Official data",
  "Nonpartisan analysis": "Nonpartisan analysis",
  Reporting: "Reporting",
  Opinion: "Opinion",
};

function iconFor(type: SourceType) {
  switch (type) {
    case "Primary source":
      return FileText;
    case "Official data":
      return BarChart3;
    case "Nonpartisan analysis":
      return LineChart;
    case "Reporting":
      return Newspaper;
    case "Opinion":
      return MessageSquareQuote;
  }
}

export default function SourcesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const gutter = width <= 380 ? 16 : 20;

  const [tab, setTab] = useState<Tab>("Sources");
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStoredZip().then(async (stored) => {
      const zip = stored && stored.length === 5 ? stored : DEFAULT_ZIP;
      setStory(await getStoryById(supabase, id, zip));
      setLoading(false);
    });
  }, [id]);

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: (story?.sources ?? []).filter((s) => s.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={[styles.appbar, { paddingHorizontal: gutter - 8 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <ChevronLeft size={26} color="#101418" strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((t) => {
          const active = tab === t;
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={styles.tab}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t}</Text>
              {active ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter }]}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={color.brand.deepTeal} />
        ) : !story ? (
          <Text style={styles.empty}>We couldn't load this story.</Text>
        ) : tab === "Overview" ? (
          <>
            <Text style={styles.heading}>What happened</Text>
            <Text style={styles.body}>{story.whatHappened}</Text>
            <Text style={[styles.heading, { marginTop: 22 }]}>Why it matters</Text>
            <Text style={styles.body}>{story.whyItMatters}</Text>
          </>
        ) : tab === "Timeline" ? (
          <>
            <Text style={styles.heading}>Where it stands</Text>
            <View style={styles.timeline}>
              <TimelineStep label="Introduced" state="done" />
              <TimelineStep label={story.storyMap.status} state="current" />
              <TimelineStep label={story.storyMap.nextCheckpoint} state="future" />
            </View>
          </>
        ) : grouped.length === 0 ? (
          <Text style={styles.empty}>No sources recorded for this story yet.</Text>
        ) : (
          <>
            {grouped.map((group) => (
              <View key={group.type} style={styles.group}>
                <Text style={styles.heading} accessibilityRole="header">
                  {GROUP_HEADINGS[group.type]}
                </Text>
                <View style={styles.card}>
                  {group.items.map((source, i) => (
                    <SourceRow
                      key={`${source.label}-${i}`}
                      source={source}
                      last={i === group.items.length - 1}
                    />
                  ))}
                </View>
              </View>
            ))}

            <View style={styles.footerNote}>
              <Text style={styles.footerNoteText}>
                We link to primary sources so you can read for yourself.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SourceRow({ source, last }: { source: Source; last: boolean }) {
  const Icon = iconFor(source.type);
  const linkable = !!source.url;

  const content = (
    <>
      <View style={styles.iconTile}>
        <Icon size={20} color="#41484F" strokeWidth={1.9} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {source.label}
        </Text>
        <Text style={styles.rowDomain} numberOfLines={1}>
          {source.domain}
        </Text>
      </View>
      {/* No link icon when there's nothing to open — the affordance would be a
          lie, and the row is inert rather than a dead tap target. */}
      {linkable ? <ExternalLink size={18} color="#5D6670" strokeWidth={1.9} /> : null}
      {!last ? <View style={styles.rowDivider} /> : null}
    </>
  );

  if (!linkable) {
    return <View style={[styles.row, styles.rowInert]}>{content}</View>;
  }

  return (
    <Pressable
      onPress={() => Linking.openURL(source.url!)}
      accessibilityRole="link"
      accessibilityLabel={`${source.label}, ${source.domain}. Opens in your browser.`}
      style={styles.row}
    >
      {content}
    </Pressable>
  );
}

function TimelineStep({ label, state }: { label: string; state: "done" | "current" | "future" }) {
  return (
    <View style={styles.timelineStep}>
      <View
        style={[
          styles.timelineDot,
          state === "done" && styles.timelineDotDone,
          state === "current" && styles.timelineDotCurrent,
        ]}
      />
      <Text style={[styles.timelineLabel, state === "future" && styles.timelineLabelFuture]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.light.canvas },

  appbar: { height: 48, justifyContent: "center" },
  backButton: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },

  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#DDE1E5", backgroundColor: "#FFFFFF" },
  tab: { flex: 1, height: 50, alignItems: "center", justifyContent: "center" },
  tabLabel: { fontSize: 15, lineHeight: 20, fontWeight: "600", color: "#5D6670" },
  tabLabelActive: { color: "#167D79", fontWeight: "700" },
  // Absolute so switching tabs never nudges the label, and it sits on the divider.
  tabUnderline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -1,
    height: 3,
    borderRadius: 999,
    backgroundColor: "#167D79",
  },

  scroll: { paddingTop: 22, paddingBottom: 40 },
  group: { marginBottom: 22 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: "700", letterSpacing: -0.2, color: "#101418" },

  card: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  row: { minHeight: 76, paddingVertical: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", columnGap: 12 },
  rowInert: { opacity: 0.75 },
  iconTile: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#F1EFEA", alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: "700", letterSpacing: -0.1, color: "#101418" },
  rowDomain: { marginTop: 2, fontSize: 13, lineHeight: 18, fontWeight: "400", color: "#5D6670" },
  // Inset to start after the icon tile, matching the reference.
  rowDivider: { position: "absolute", left: 70, right: 0, bottom: 0, height: 1, backgroundColor: "#E7E9EC" },

  footerNote: { marginTop: 4, padding: 16, borderRadius: 12, backgroundColor: color.brand.warmSand },
  footerNoteText: { fontSize: 14, lineHeight: 21, fontWeight: "400", color: "#41484F" },

  body: { marginTop: 8, fontSize: 15, lineHeight: 23, fontWeight: "400", color: "#41484F" },
  empty: { marginTop: 40, textAlign: "center", fontSize: 14, lineHeight: 21, color: "#5D6670" },

  timeline: { marginTop: 14, marginLeft: 6, borderLeftWidth: 2, borderLeftColor: "#DDE1E5" },
  timelineStep: { paddingVertical: 10, paddingLeft: 20, position: "relative" },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#DDE1E5",
    backgroundColor: "#FFFFFF",
    position: "absolute",
    left: -7,
    top: 14,
  },
  timelineDotDone: { borderColor: color.brand.civicTeal, backgroundColor: color.brand.civicTeal },
  timelineDotCurrent: { borderColor: color.brand.signalGold },
  timelineLabel: { fontSize: 14.5, lineHeight: 21, color: "#101418" },
  timelineLabelFuture: { color: "#5D6670" },
});
