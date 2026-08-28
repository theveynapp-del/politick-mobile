import { useState, useEffect } from "react";
import { View, Pressable, Image, ScrollView, StyleSheet, Linking, ActivityIndicator } from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Phone, Globe, ExternalLink } from "lucide-react-native";
import { color, radius } from "@/lib/tokens";
import { supabase } from "@/lib/supabase";
import { getRepresentativesByZip } from "@/lib/queries";
import { getZipOrDefault } from "@/lib/onboarding";
import { getGovActivity, bioguideIdsFor, GovActivityItem } from "@/lib/govActivity";
import { getMemberVotes, stanceLabel, stanceOf, MemberVote } from "@/lib/memberVotes";
import { officeProfileFor } from "@/lib/officeRoles";
import { Representative } from "@/lib/types";

/**
 * A single official, and what they've actually been doing.
 *
 * Two tabs, not four. The previous version had Overview, Votes, Activity and
 * About: Overview and About rendered identical content, Votes announced "this
 * demo profile has no tracked voting record" to real users, and Activity
 * claimed it had "checked today" without ever making a request. A tab that
 * states a finding it never looked for is worse than no tab — it reads as
 * "we checked and there's nothing", which is a claim about the official.
 *
 * Activity is now a real query against Congress.gov. Where we genuinely have
 * no source — state and local officials aren't published in a national feed —
 * it says that plainly instead of implying an empty record.
 */
type Tab = "overview" | "votes" | "sponsored";

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  votes: "Votes",
  sponsored: "Sponsored",
};

export default function RepresentativeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [rep, setRep] = useState<Representative | null>(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<GovActivityItem[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [votes, setVotes] = useState<MemberVote[] | null>(null);
  const [votesLoading, setVotesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The reader's own ZIP. This used to be the literal "20814", so anyone
      // outside Bethesda tapped a representative and got a blank screen: the
      // id they tapped was never in the set this query returned.
      const zip = await getZipOrDefault();
      const all = await getRepresentativesByZip(supabase, zip);
      if (cancelled) return;
      setRep(all.find((r) => r.id === id) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Federal members have a bioguide ID, which is what Congress.gov keys on.
  const bioguideId = rep ? bioguideIdsFor([rep])[0] ?? null : null;

  useEffect(() => {
    if (tab !== "sponsored" || !bioguideId || activity !== null) return;
    setActivityLoading(true);
    getGovActivity(supabase, [bioguideId])
      .then(setActivity)
      .finally(() => setActivityLoading(false));
  }, [tab, bioguideId, activity]);

  useEffect(() => {
    if (tab !== "votes" || !bioguideId || votes !== null) return;
    setVotesLoading(true);
    getMemberVotes(supabase, bioguideId)
      .then(setVotes)
      .finally(() => setVotesLoading(false));
  }, [tab, bioguideId, votes]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Appbar onBack={() => router.back()} />
        <View style={styles.centered}>
          <ActivityIndicator color={color.brand.deepTeal} />
        </View>
      </SafeAreaView>
    );
  }

  if (!rep) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Appbar onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>We couldn&rsquo;t load this official</Text>
          <Text style={styles.emptyBody}>
            They may not be among the officials for your ZIP code. Go back to Reps and try again.
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.back()}>
            <Text style={styles.emptyBtnText}>Back to Reps</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const canCall = !!rep.phone;
  const canOpenSite = !!rep.website;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Appbar onBack={() => router.back()} />

      <ScrollView>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            {rep.photoUrl ? (
              <Image source={{ uri: rep.photoUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {rep.name.split(" ").slice(-1)[0].slice(0, 2).toUpperCase()}
              </Text>
            )}
          </View>
          <Text style={styles.name}>{rep.name}</Text>
          <Text style={styles.role}>{rep.role}</Text>
          {rep.district ? <Text style={styles.district}>{rep.district}</Text> : null}
        </View>

        {/* Only the actions we can actually perform. Email and Directions were
            permanently disabled tiles — there is no address or email on the
            record — so they were four buttons of which two never worked. */}
        <View style={styles.contactGrid}>
          <ContactAction
            icon={Phone}
            label="Call office"
            disabled={!canCall}
            onPress={() => rep.phone && Linking.openURL(`tel:${rep.phone}`)}
          />
          <ContactAction
            icon={Globe}
            label="Official site"
            disabled={!canOpenSite}
            onPress={() => rep.website && Linking.openURL(rep.website)}
          />
        </View>
        {!canCall && !canOpenSite ? (
          <Text style={styles.noContact}>No contact details on file for this office yet.</Text>
        ) : null}

        <View style={styles.segmented}>
          {(["overview", "votes", "sponsored"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
              style={[styles.segmentBtn, tab === t && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
                {TAB_LABELS[t]}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ padding: 20, paddingBottom: 40 }}>
          {tab === "overview" ? (
            <>
              <OfficeExplainer rep={rep} />
              {rep.jurisdictionConfidence === "Needs review" ? (
                <View style={styles.noteCard}>
                  <Text style={styles.noteText}>
                    Your ZIP code spans more than one district, so we can&rsquo;t be certain this
                    is your seat. Your county election office can confirm it.
                  </Text>
                </View>
              ) : null}
            </>
          ) : tab === "votes" ? (
            <VotesTab rep={rep} bioguideId={bioguideId} votes={votes} loading={votesLoading} />
          ) : (
            <ActivityTab
              rep={rep}
              bioguideId={bioguideId}
              activity={activity}
              loading={activityLoading}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * What the office does, at a length that can actually answer the question.
 *
 * Falls back to the record's own one-line `controls` string when the title
 * isn't one lib/officeRoles recognises — better a thin true sentence than a
 * confident description of an office we haven't checked.
 */
function OfficeExplainer({ rep }: { rep: Representative }) {
  const profile = officeProfileFor(rep.role, rep.level);

  if (!profile) {
    return (
      <View style={styles.officeCard}>
        <Text style={styles.officeLabel}>WHAT THIS OFFICE DOES</Text>
        <Text style={styles.officeBody}>{rep.controls}</Text>
      </View>
    );
  }

  return (
    <View style={styles.officeCard}>
      <Text style={styles.officeLabel}>WHAT THIS OFFICE DOES</Text>
      <Text style={styles.officeSummary}>{profile.summary}</Text>

      <Text style={styles.officeSubLabel}>WHAT THEY DECIDE</Text>
      {profile.decides.map((d) => (
        <View key={d} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Text style={styles.bulletText}>{d}</Text>
        </View>
      ))}

      {profile.limits ? (
        <View style={styles.limitBox}>
          <Text style={styles.limitLabel}>WHAT THEY CAN&rsquo;T DO</Text>
          <Text style={styles.limitText}>{profile.limits}</Text>
        </View>
      ) : null}

      {profile.term ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>TERM</Text>
          <Text style={styles.metaText}>{profile.term}</Text>
        </View>
      ) : null}

      {profile.varies ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>VARIES BY PLACE</Text>
          <Text style={styles.metaText}>{profile.varies}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Appbar({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.appbar}>
      <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
        <ChevronLeft size={24} color={color.light.ink} />
      </Pressable>
      <Text style={styles.appbarTitle}>Representative</Text>
      {/* Balances the back button. The old overflow icon looked pressable and
          did nothing. */}
      <View style={{ width: 24 }} />
    </View>
  );
}

function ContactAction({
  icon: Icon,
  label,
  disabled,
  onPress,
}: {
  icon: typeof Phone;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.contactAction, disabled && styles.contactActionDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={label}
    >
      <Icon size={16} color={disabled ? color.light.muted : color.light.ink} />
      <Text style={[styles.contactActionText, disabled && { color: color.light.muted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * How this member actually voted.
 *
 * The plain-language line comes first and the official question second: the
 * whole point is that "On Cloture on the Motion to Proceed" tells a reader
 * nothing, while "a vote on whether to end debate" tells them what happened.
 * The official wording stays underneath so nothing is hidden behind the
 * rephrasing.
 *
 * The chamber's result is shown separately from the member's position and
 * never styled to suggest one is right — yes is not good and no is not bad.
 */
function VotesTab({
  rep,
  bioguideId,
  votes,
  loading,
}: {
  rep: Representative;
  bioguideId: string | null;
  votes: MemberVote[] | null;
  loading: boolean;
}) {
  if (!bioguideId) {
    return (
      <View style={styles.activityRow}>
        <Text style={styles.activityTitle}>No published voting record</Text>
        <Text style={styles.activityDesc}>
          {rep.level === "Federal"
            ? "We couldn't match this member to the congressional record."
            : `${rep.level} bodies don't publish roll-call votes in a single national feed. Their official site is the authoritative source.`}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centeredInline}>
        <ActivityIndicator color={color.brand.deepTeal} />
      </View>
    );
  }

  if (!votes || votes.length === 0) {
    const isSenator = rep.role.toLowerCase().includes("senator");
    return (
      <View style={styles.activityRow}>
        <Text style={styles.activityTitle}>
          {isSenator ? "Senate votes aren't available yet" : "No recent votes on file"}
        </Text>
        <Text style={styles.activityDesc}>
          {isSenator
            ? "The Senate publishes roll calls only on senate.gov, which blocks automated access, and no official API carries them. We're working on a route to it rather than guessing."
            : "Nothing has come through for this member yet. Recorded votes appear here within a day of the chamber taking them."}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.activityHeading}>
        {votes.length} MOST RECENT {votes.length === 1 ? "VOTE" : "VOTES"}
      </Text>
      {votes.map((v) => {
        const stance = stanceOf(v.voteCast);
        return (
          <Pressable
            key={v.rollCallId}
            style={styles.billCard}
            onPress={() => Linking.openURL(v.billUrl ?? v.sourceUrl)}
            accessibilityRole="link"
            accessibilityLabel={`${stanceLabel(v.voteCast)} on ${v.plainSummary ?? v.question}. Opens the official record.`}
          >
            <View style={styles.billTop}>
              <View style={[styles.stancePill, stanceStyle[stance]]}>
                <Text style={[styles.stanceText, stanceTextStyle[stance]]}>
                  {stanceLabel(v.voteCast).toUpperCase()}
                </Text>
              </View>
              {v.billCitation ? <Text style={styles.billCitation}>{v.billCitation}</Text> : null}
            </View>

            <Text style={styles.billTitle}>{v.plainSummary ?? v.question}</Text>

            {v.plainSummary ? (
              <Text style={styles.officialQuestion} numberOfLines={2}>
                Official wording: {v.question}
              </Text>
            ) : null}

            {v.result ? (
              <Text style={styles.billAction}>
                Chamber result: {v.result}
              </Text>
            ) : null}

            <View style={styles.billLink}>
              <ExternalLink size={12} color={color.brand.deepTeal} strokeWidth={2.2} />
              <Text style={styles.billLinkText}>See the official record</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Real sponsorship activity from Congress.gov, or an honest account of why
 * there isn't any. The three states are distinct on purpose: "we have no
 * source for this office" is a different fact from "we looked and they have
 * sponsored nothing recently", and collapsing them would misrepresent one.
 */
function ActivityTab({
  rep,
  bioguideId,
  activity,
  loading,
}: {
  rep: Representative;
  bioguideId: string | null;
  activity: GovActivityItem[] | null;
  loading: boolean;
}) {
  if (!bioguideId) {
    return (
      <View style={styles.activityRow}>
        <Text style={styles.activityTitle}>No national record for this office</Text>
        <Text style={styles.activityDesc}>
          {rep.level === "Federal"
            ? "We couldn't match this member to the congressional record."
            : `${rep.level} legislatures and councils don't publish votes in one national feed the way Congress does. Their official site is the authoritative source.`}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centeredInline}>
        <ActivityIndicator color={color.brand.deepTeal} />
      </View>
    );
  }

  if (!activity || activity.length === 0) {
    return (
      <View style={styles.activityRow}>
        <Text style={styles.activityTitle}>Nothing in the current session yet</Text>
        <Text style={styles.activityDesc}>
          No bills sponsored or cosponsored by this member came back from Congress.gov. That can
          change any day the chamber is in session.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.activityHeading}>
        {activity.length} {activity.length === 1 ? "BILL" : "BILLS"} ON THE RECORD
      </Text>
      {activity.map((item) => (
        <Pressable
          key={`${item.citation}-${item.relationshipType}`}
          style={styles.billCard}
          onPress={() => Linking.openURL(item.url)}
          accessibilityRole="link"
          accessibilityLabel={`${item.citation}, ${item.title}. Opens congress.gov`}
        >
          <View style={styles.billTop}>
            <Text style={styles.billCitation}>{item.citation}</Text>
            <View style={styles.billRel}>
              <Text style={styles.billRelText}>
                {item.relationshipType === "sponsored" ? "SPONSOR" : "COSPONSOR"}
              </Text>
            </View>
          </View>
          <Text style={styles.billTitle} numberOfLines={3}>
            {item.title}
          </Text>
          {item.latestAction ? (
            <Text style={styles.billAction} numberOfLines={2}>
              {item.latestAction}
            </Text>
          ) : null}
          <View style={styles.billLink}>
            <ExternalLink size={12} color={color.brand.deepTeal} strokeWidth={2.2} />
            <Text style={styles.billLinkText}>View on congress.gov</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.light.canvas },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  centeredInline: { paddingVertical: 32, alignItems: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: color.light.ink, textAlign: "center" },
  emptyBody: { fontSize: 13.5, lineHeight: 20, color: color.light.muted, textAlign: "center" },
  emptyBtn: { marginTop: 12, backgroundColor: color.brand.deepTeal, borderRadius: radius.button, paddingHorizontal: 20, height: 44, alignItems: "center", justifyContent: "center" },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  appbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 56, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: color.light.border, backgroundColor: color.light.surface },
  appbarTitle: { fontSize: 14, fontWeight: "700", color: color.light.ink },
  hero: { alignItems: "center", padding: 24, borderBottomWidth: 1, borderBottomColor: color.light.border },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: color.brand.softTeal, alignItems: "center", justifyContent: "center", marginBottom: 12, overflow: "hidden" },
  avatarImage: { width: 76, height: 76 },
  avatarText: { fontSize: 22, fontWeight: "800", color: color.brand.deepTeal },
  name: { fontSize: 21, fontWeight: "800", color: color.light.ink, marginBottom: 3, textAlign: "center" },
  role: { fontSize: 13, color: color.light.muted },
  district: { fontSize: 12, fontWeight: "700", color: color.brand.deepTeal, marginTop: 6 },
  contactGrid: { flexDirection: "row", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4, gap: 10 },
  contactAction: { flex: 1, flexDirection: "row", justifyContent: "center", borderWidth: 1, borderColor: color.light.border, backgroundColor: color.light.surface, borderRadius: 12, paddingVertical: 13, alignItems: "center", gap: 7 },
  contactActionDisabled: { opacity: 0.4 },
  contactActionText: { fontSize: 12.5, fontWeight: "700", color: color.light.ink },
  noContact: { fontSize: 12, color: color.light.muted, paddingHorizontal: 20, paddingTop: 8 },
  segmented: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: color.light.border, marginTop: 16 },
  segmentBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  segmentBtnActive: { borderBottomColor: color.brand.signalGold },
  segmentText: { fontSize: 13, fontWeight: "700", color: color.light.muted },
  segmentTextActive: { color: color.brand.deepTeal },
  officeCard: { backgroundColor: color.light.surface, borderWidth: 1, borderColor: color.light.border, borderRadius: radius.card, padding: 16 },
  officeLabel: { fontSize: 10.5, fontWeight: "800", color: color.brand.deepTeal, marginBottom: 8, letterSpacing: 0.4 },
  officeBody: { fontSize: 14, lineHeight: 20, color: color.light.ink },
  officeSummary: { fontSize: 14.5, lineHeight: 21, color: color.light.ink, marginBottom: 16 },
  officeSubLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4, color: color.light.muted, marginBottom: 8 },
  bulletRow: { flexDirection: "row", gap: 9, marginBottom: 8 },
  bulletDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: color.brand.signalGold, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 13.5, lineHeight: 19.5, color: color.light.ink },
  limitBox: { marginTop: 8, backgroundColor: color.brand.warmSand, borderRadius: 12, padding: 13 },
  limitLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4, color: "#7A5B2E", marginBottom: 5 },
  limitText: { fontSize: 13, lineHeight: 19, color: color.light.ink },
  metaRow: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: color.light.border },
  metaLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4, color: color.light.muted, marginBottom: 4 },
  metaText: { fontSize: 13, lineHeight: 19, color: color.light.muted },
  noteCard: { marginTop: 12, backgroundColor: color.brand.warmSand, borderRadius: radius.card, padding: 14 },
  noteText: { fontSize: 12.5, lineHeight: 18, color: color.light.ink },
  activityRow: { backgroundColor: color.light.surface, borderWidth: 1, borderColor: color.light.border, borderRadius: radius.card, padding: 16 },
  activityTitle: { fontSize: 14, fontWeight: "700", color: color.light.ink, marginBottom: 4 },
  activityDesc: { fontSize: 12.5, color: color.light.muted, lineHeight: 18 },
  activityHeading: { fontSize: 10.5, fontWeight: "800", color: color.brand.deepTeal, letterSpacing: 0.4, marginBottom: 2 },
  billCard: { backgroundColor: color.light.surface, borderWidth: 1, borderColor: color.light.border, borderRadius: radius.card, padding: 14 },
  billTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8 },
  billCitation: { fontSize: 12.5, fontWeight: "800", color: color.light.ink },
  billRel: { backgroundColor: color.brand.softTeal, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  billRelText: { fontSize: 9, fontWeight: "800", color: color.brand.deepTeal, letterSpacing: 0.4 },
  billTitle: { fontSize: 13.5, lineHeight: 19, color: color.light.ink, marginBottom: 6 },
  billAction: { fontSize: 12, lineHeight: 17, color: color.light.muted },
  billLink: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
  billLinkText: { fontSize: 11.5, fontWeight: "700", color: color.brand.deepTeal },
  officialQuestion: { fontSize: 11.5, lineHeight: 16, color: color.light.muted, fontStyle: "italic", marginBottom: 6 },
  stancePill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  stanceText: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.4 },
});

/**
 * Neutral by construction. A yes and a no are given equal visual weight in the
 * brand's own teal and sand — never green/red or blue/red, which would read as
 * approval or as party.
 */
const stanceStyle = StyleSheet.create({
  yes: { backgroundColor: color.brand.softTeal },
  no: { backgroundColor: color.brand.warmSand },
  abstain: { backgroundColor: color.light.border },
});

const stanceTextStyle = StyleSheet.create({
  yes: { color: color.brand.deepTeal },
  no: { color: "#7A5B2E" },
  abstain: { color: color.light.muted },
});
