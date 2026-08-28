import { useState, useEffect } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Linking,
  useWindowDimensions,
} from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Search, Sparkles, ChevronRight, ExternalLink } from "lucide-react-native";
import { color } from "@/lib/tokens";
import { supabase } from "@/lib/supabase";
import { getTodayStories, getRepresentativesByZip, getZipLocation } from "@/lib/queries";
import { stateForZip } from "@/lib/zipToState";
import { getStoredZip, getStoredTopics } from "@/lib/onboarding";
import { Story, Representative } from "@/lib/types";
import { estimateReadMinutes } from "@/lib/readTime";
import { searchExplore, ExploreSearchResult } from "@/lib/exploreSearch";
import { searchBills, BillSearchResult } from "@/lib/billSearch";
import { getGovActivity, bioguideIdsFor, GovActivityItem } from "@/lib/govActivity";
import { detectTerm, JargonTerm } from "@/lib/jargon";
import { defineTerm, DefinitionResult } from "@/lib/defineTerm";
import { stageFromAction } from "@/lib/billStage";
import { federalBallot, CYCLE_YEAR as ELECTION_CYCLE } from "@/lib/election";
import { SectionHeader } from "@/components/explore/SectionHeader";
import {
  GovernmentActivityCard,
  OfficialActivityCard,
  ContextLearningCard,
  IssueChip,
  ElectionCenterCard,
} from "@/components/explore/cards";
import { JargonSheet } from "@/components/explore/JargonSheet";

import { CORE_ISSUES, EXTRA_ISSUES } from "@/lib/issueIcons";

const DEFAULT_ZIP = "20814";

/** The next federal general election. Fixed and factual, not a data claim. */
const CYCLE_YEAR = ELECTION_CYCLE;

export default function ExploreScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tight = width <= 380;
  const gutter = tight ? 16 : 20;

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [result, setResult] = useState<ExploreSearchResult | null>(null);
  const [bills, setBills] = useState<BillSearchResult | null>(null);
  // The explainer lane: what the term means, even when nothing in the app
  // covers it. Either a reviewed entry from the jargon library or, failing
  // that, a definition-only model answer.
  const [defn, setDefn] = useState<DefinitionResult | null>(null);
  const [defnTerm, setDefnTerm] = useState<JargonTerm | null>(null);

  const [stateName, setStateName] = useState<string | null>(null);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [stateAbbr, setStateAbbr] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [worldStories, setWorldStories] = useState<Story[]>([]);
  const [reps, setReps] = useState<Representative[]>([]);
  const [activity, setActivity] = useState<GovActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // "See all" expands in place. Every section it appears on has more real
  // items to show, so it does something rather than routing to a page that
  // doesn't exist yet.
  const [showAllGov, setShowAllGov] = useState(false);
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [showAllWorld, setShowAllWorld] = useState(false);

  const [sheetTerm, setSheetTerm] = useState<JargonTerm | null>(null);
  const [sheetContext, setSheetContext] = useState<string | null>(null);

  // Sections resolve independently so one slow upstream can't blank the page.
  useEffect(() => {
    getStoredTopics().then(setTopics);
    getStoredZip().then(async (stored) => {
      const zip = stored && stored.length === 5 ? stored : DEFAULT_ZIP;
      setStateName(stateForZip(zip));
      getZipLocation(supabase, zip).then((p) => {
        setPlaceLabel(p ? `${p.city}, ${p.stateAbbr}` : stateForZip(zip));
        setStateAbbr(p?.stateAbbr ?? null);
      });
      getTodayStories(supabase, zip).then((all) =>
        setWorldStories(all.filter((s) => s.scope === "World"))
      );

      const resolved = await getRepresentativesByZip(supabase, zip);
      setReps(resolved);
      setActivity(await getGovActivity(supabase, bioguideIdsFor(resolved)));
      setActivityLoading(false);
    });
  }, []);

  const runSearch = async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    setActiveQuery(q);
    setResult(null);
    setBills(null);
    setDefn(null);
    setDefnTerm(null);

    // The library is free, instant and hand-checked, so it wins when it has
    // the term; the model is only asked about words it doesn't cover.
    const known = detectTerm(q);
    setDefnTerm(known);

    const [coverage, legislation, definition] = await Promise.all([
      searchExplore(supabase, q, { state: stateName, topics }),
      searchBills(supabase, q),
      known ? Promise.resolve(null) : defineTerm(supabase, q),
    ]);
    setResult(coverage);
    setBills(legislation);
    setDefn(definition);
    setSearching(false);
  };

  const clearSearch = () => {
    setQuery("");
    setActiveQuery(null);
    setResult(null);
    setBills(null);
    setDefn(null);
    setDefnTerm(null);
  };

  const repFor = (bioguideId: string) => reps.find((r) => r.externalId === bioguideId) ?? null;
  const federalReps = reps.filter((r) => r.level === "Federal");

  // Anchored to a bill the reader is actually being shown, so the term is one
  // they've just encountered rather than a lesson chosen for them.
  const learningSource = activity.find((a) => detectTerm(a.latestAction));
  const learningTerm = learningSource ? detectTerm(learningSource.latestAction) : null;
  const learningContext = learningSource
    ? `${learningSource.citation} — ${learningSource.latestAction}`
    : null;

  const openBill = (item: GovActivityItem) => Linking.openURL(item.url);
  const searchResults = result?.found ? result.stories ?? [] : [];

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: gutter }}>
          <View style={styles.titleRow}>
            <Image
              source={require("@/assets/politick-emblem.png")}
              style={styles.emblem}
              resizeMode="contain"
              accessibilityLabel=""
            />
            <Text style={styles.title} accessibilityRole="header">Explore</Text>
          </View>
          <View style={styles.searchField}>
            <Search size={19} color="#7A848D" strokeWidth={1.9} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search a bill, official, topic, or political term"
              placeholderTextColor="#7A848D"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => runSearch(query)}
              returnKeyType="search"
              accessibilityLabel="Search a bill, official, topic, or political term"
            />
          </View>
        </View>

        {(searching || result || bills) && (
          <View style={[styles.searchResults, { paddingHorizontal: gutter }]}>
            {!searching && (defnTerm || defn?.found) ? (
              <Pressable
                onPress={() => {
                  if (defnTerm) {
                    setSheetTerm(defnTerm);
                    setSheetContext(null);
                  }
                }}
                disabled={!defnTerm}
                accessibilityRole={defnTerm ? "button" : undefined}
                style={styles.defnCard}
              >
                <Text style={styles.defnLabel}>WHAT THIS MEANS</Text>
                <Text style={styles.defnTerm}>{defnTerm ? defnTerm.term : defn?.term}</Text>
                <Text style={styles.defnBody}>
                  {defnTerm ? defnTerm.shortDefinition : defn?.definition}
                </Text>
                <Text style={styles.defnNote}>
                  {defnTerm
                    ? "Tap for the full explanation."
                    : "A general definition, not coverage of a specific bill or event."}
                </Text>
              </Pressable>
            ) : null}

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

            {searchResults.length > 0 ? (
              <View style={styles.hits}>
                <Text style={styles.hitsHeading}>In your feed</Text>
                {searchResults.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => router.push(`/story/${s.id}`)}
                    accessibilityRole="link"
                    accessibilityLabel={s.headline}
                    style={styles.hit}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.hitScope}>{s.scope.toUpperCase()} · {s.topic}</Text>
                      <Text style={styles.hitHeadline} numberOfLines={2}>{s.headline}</Text>
                    </View>
                    <ChevronRight size={18} color="#5D6670" strokeWidth={1.9} />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {!searching && bills && bills.bills.length > 0 ? (
              <View style={styles.hits}>
                <Text style={styles.hitsHeading}>Bills in Congress</Text>
                {bills.bills.map((b) => (
                  <Pressable
                    key={`${b.congress}-${b.type}-${b.number}`}
                    onPress={() => Linking.openURL(b.url)}
                    accessibilityRole="link"
                    accessibilityLabel={`${b.citation}, ${b.title}. Opens congress.gov.`}
                    style={styles.hit}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.hitScope}>{b.citation} · {b.congress}TH CONGRESS</Text>
                      <Text style={styles.hitHeadline} numberOfLines={2}>{b.title}</Text>
                    </View>
                    <ExternalLink size={17} color="#5D6670" strokeWidth={1.9} />
                  </Pressable>
                ))}
                <Text style={styles.footnote}>Source: congress.gov</Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader
            title="In your government"
            subtitle="Recent legislation and activity connected to your representatives."
            actionLabel={activity.length > 4 ? (showAllGov ? "Show less" : "See all") : undefined}
            onAction={activity.length > 4 ? () => setShowAllGov((v) => !v) : undefined}
            gutter={gutter}
          />
          {activityLoading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={color.brand.deepTeal} />
          ) : activity.length === 0 ? (
            <View style={{ paddingHorizontal: gutter }}>
              <Text style={styles.emptyText}>
                No recent activity from your representatives. Explore current legislation instead.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal={!showAllGov}
              scrollEnabled={!showAllGov}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                showAllGov ? styles.stack : styles.strip,
                { paddingHorizontal: gutter },
              ]}
            >
              {activity.slice(0, showAllGov ? 12 : 8).map((item, i) => {
                const rep = repFor(item.bioguideId);
                return (
                  <GovernmentActivityCard
                    key={`${item.citation}-${i}`}
                    item={item}
                    repName={rep?.name ?? null}
                    repPhoto={rep?.photoUrl ?? null}
                    fullWidth={showAllGov}
                    onPress={() => openBill(item)}
                  />
                );
              })}
            </ScrollView>
          )}
        </View>

        {learningTerm && learningContext ? (
          <View style={styles.section}>
            <SectionHeader title="Learn from what's happening" gutter={gutter} />
            <ContextLearningCard
              term={learningTerm}
              contextSentence={learningContext}
              gutter={gutter}
              onPress={() => {
                setSheetTerm(learningTerm);
                setSheetContext(learningContext);
              }}
            />
          </View>
        ) : null}

        {federalReps.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="Your officials in action"
              actionLabel="See all"
              onAction={() => router.push("/reps")}
              gutter={gutter}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.strip, { paddingHorizontal: gutter }]}
            >
              {federalReps.map((rep) => (
                <OfficialActivityCard
                  key={rep.id}
                  name={rep.name}
                  office={
                    rep.role === "US Senator"
                      ? "U.S. Senate"
                      : `U.S. House${rep.district ? ` · ${rep.district}` : ""}`
                  }
                  photoUrl={rep.photoUrl}
                  items={activity.filter((a) => a.bioguideId === rep.externalId)}
                  onPressItem={openBill}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            title="Explore an issue"
            actionLabel={showAllIssues ? "Show less" : "See all"}
            onAction={() => setShowAllIssues((v) => !v)}
            gutter={gutter}
          />
          <View style={[styles.issueGrid, { paddingHorizontal: gutter }]}>
            {(showAllIssues ? [...CORE_ISSUES, ...EXTRA_ISSUES] : CORE_ISSUES).map((issue) => (
              <IssueChip
                key={issue}
                label={issue}
                onPress={() => {
                  setQuery(issue);
                  runSearch(issue);
                }}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ElectionCenterCard
            placeLabel={placeLabel}
            cycleYear={CYCLE_YEAR}
            ballot={federalBallot(stateAbbr, stateName, reps)}
            gutter={gutter}
            onOpen={() => router.push("/election")}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Around the world"
            actionLabel={worldStories.length > 5 ? (showAllWorld ? "Show less" : "See all") : undefined}
            onAction={worldStories.length > 5 ? () => setShowAllWorld((v) => !v) : undefined}
            gutter={gutter}
          />
          <View style={{ paddingHorizontal: gutter }}>
            <View style={styles.worldModule}>
              <Image
                source={require("@/assets/explore/world-map.jpg")}
                style={[styles.worldMap, tight && styles.worldMapTight]}
                resizeMode="cover"
                accessibilityLabel="World map highlighting current international stories"
              />
              {worldStories.length === 0 ? (
                <View style={styles.worldRow}>
                  <Text style={styles.emptyText}>No world coverage available right now.</Text>
                </View>
              ) : (
                worldStories.slice(0, showAllWorld ? worldStories.length : 5).map((story, i) => (
                  <Pressable
                    key={story.id}
                    onPress={() => router.push(`/story/${story.id}`)}
                    accessibilityRole="link"
                    accessibilityLabel={story.headline}
                    style={styles.worldRow}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.worldMeta}>
                        {story.scope.toUpperCase()} · {estimateReadMinutes(story)} MIN READ
                      </Text>
                      <Text style={styles.worldHeadline} numberOfLines={2}>{story.headline}</Text>
                    </View>
                    <ChevronRight size={20} color="#5D6670" strokeWidth={1.9} />
                    {i < Math.min(worldStories.length, showAllWorld ? worldStories.length : 5) - 1 ? <View style={styles.worldDivider} /> : null}
                  </Pressable>
                ))
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <JargonSheet
        term={sheetTerm}
        contextSentence={sheetContext}
        stage={stageFromAction(learningSource?.latestAction)}
        onClose={() => setSheetTerm(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.light.canvas },
  scroll: { paddingTop: 20, paddingBottom: 110 },

  // Brand mark inline with the title, so it costs no vertical space — the
  // screen title keeps doing the wayfinding and the emblem just makes sure
  // Politick is present if the screen is ever screenshotted.
  titleRow: { flexDirection: "row", alignItems: "center", columnGap: 9 },
  emblem: { width: 24, height: 24 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: "700", letterSpacing: -0.5, color: "#101418" },
  searchField: {
    marginTop: 14,
    height: 44,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    backgroundColor: "#FFFFFF",
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 19, fontWeight: "400", color: "#101418" },

  section: { marginTop: 22 },
  strip: { columnGap: 12 },
  stack: { flexDirection: "column", rowGap: 12 },
  issueGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emptyText: { fontSize: 13.5, lineHeight: 19, color: "#5D6670" },

  searchResults: { marginTop: 20 },
  defnCard: {
    marginBottom: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(22,125,121,0.18)",
    borderRadius: 14,
    backgroundColor: "#F3FAF8",
  },
  defnLabel: { fontSize: 10.5, lineHeight: 14, fontWeight: "700", letterSpacing: 0.5, color: "#0D5F5B" },
  defnTerm: { marginTop: 4, fontSize: 17, lineHeight: 23, fontWeight: "700", letterSpacing: -0.2, color: "#101418", textTransform: "capitalize" },
  defnBody: { marginTop: 5, fontSize: 13.5, lineHeight: 20, color: "#41484F" },
  defnNote: { marginTop: 8, fontSize: 11.5, lineHeight: 16, color: "#5D6670" },

  resultCard: { backgroundColor: color.brand.warmSand, borderRadius: 14, padding: 16 },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  resultHeaderText: { flex: 1, fontSize: 11, fontWeight: "700", color: color.brand.deepTeal, textTransform: "uppercase", letterSpacing: 0.3 },
  clearText: { fontSize: 11.5, fontWeight: "600", color: color.light.muted },
  resultText: { fontSize: 14.5, lineHeight: 21, color: color.light.ink },
  resultEmptyText: { fontSize: 13.5, lineHeight: 19, color: color.light.muted },

  hits: { marginTop: 12 },
  hitsHeading: { fontSize: 12, lineHeight: 16, fontWeight: "700", letterSpacing: 0.3, color: "#5D6670", textTransform: "uppercase" },
  hit: {
    marginTop: 8,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  hitScope: { fontSize: 10.5, lineHeight: 14, fontWeight: "700", letterSpacing: 0.3, color: "#5D6670" },
  hitHeadline: { marginTop: 2, fontSize: 14, lineHeight: 18, fontWeight: "700", letterSpacing: -0.1, color: "#101418" },
  footnote: { marginTop: 8, fontSize: 11.5, lineHeight: 16, color: "#8A929A" },

  worldModule: { overflow: "hidden", borderWidth: 1, borderColor: "#DDE1E5", borderRadius: 14, backgroundColor: "#FFFFFF" },
  worldMap: { width: "100%", height: 132, backgroundColor: "#F2EFE7" },
  worldMapTight: { height: 122 },
  worldRow: { minHeight: 76, paddingVertical: 13, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", columnGap: 12 },
  worldDivider: { position: "absolute", left: 15, right: 0, bottom: 0, height: 1, backgroundColor: "#E7E9EC" },
  worldMeta: { fontSize: 10.5, lineHeight: 14, fontWeight: "700", letterSpacing: 0.3, color: "#5D6670" },
  worldHeadline: { marginTop: 3, fontSize: 14, lineHeight: 19, fontWeight: "700", letterSpacing: -0.15, color: "#101418" },
});
