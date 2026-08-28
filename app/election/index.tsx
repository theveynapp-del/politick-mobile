import { useState, useEffect } from "react";
import { View, Pressable, ScrollView, StyleSheet, Linking, ActivityIndicator } from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, ExternalLink, CheckCircle2, ChevronRight } from "lucide-react-native";
import { color, radius } from "@/lib/tokens";
import { supabase } from "@/lib/supabase";
import { getRepresentativesByZip, getZipLocation, ZipLocation } from "@/lib/queries";
import { getZipOrDefault } from "@/lib/onboarding";
import { stateForZip } from "@/lib/zipToState";
import {
  federalBallot,
  daysUntilElection,
  hasBallotInfo,
  BallotOffice,
  BOOTH_NOTES,
  BALLOT_TERMS,
  CYCLE_YEAR,
} from "@/lib/election";
import { Representative } from "@/lib/types";

/**
 * Election Center.
 *
 * The card in Explore answers "is there an election and what's on it". This
 * screen answers the harder question people actually have, which is "I'm
 * standing in the booth and I don't know what half of this means".
 *
 * Three layers, in the order a voter needs them:
 *   1. What's on your ballot        — from the record, fails closed
 *   2. What you're deciding         — per office, in plain words
 *   3. How the booth itself works   — settled procedure, the part nobody explains
 *
 * Candidates are absent on purpose. We have no entitled ballot source, and a
 * partial candidate list is the one error that could change a vote.
 */
export default function ElectionCenterScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [place, setPlace] = useState<ZipLocation | null>(null);
  const [reps, setReps] = useState<Representative[]>([]);
  const [zip, setZip] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const z = await getZipOrDefault();
      const [p, r] = await Promise.all([
        getZipLocation(supabase, z),
        getRepresentativesByZip(supabase, z),
      ]);
      if (cancelled) return;
      setZip(z);
      setPlace(p);
      setReps(r);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const days = daysUntilElection();
  const stateAbbr = place?.stateAbbr ?? null;
  // zip_locations carries the abbreviation; the full name comes from the ZIP
  // prefix table, same as Explore resolves it.
  const stateName = zip ? stateForZip(zip) : null;
  const ballot = hasBallotInfo(stateAbbr) ? federalBallot(stateAbbr, stateName, reps) : [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.appbar}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <ChevronLeft size={24} color={color.light.ink} />
        </Pressable>
        <Text style={styles.appbarTitle}>Election Center</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={color.brand.deepTeal} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
          <View style={styles.hero}>
            <Text style={styles.heroYear}>{CYCLE_YEAR} MIDTERMS</Text>
            <Text style={styles.heroDays}>{days > 0 ? days : 0}</Text>
            <Text style={styles.heroDaysLabel}>
              {days > 0 ? "days until Election Day" : "Election Day is today"}
            </Text>
            <Text style={styles.heroDate}>Tuesday, November 3, 2026</Text>
            {place ? (
              <Text style={styles.heroPlace}>
                {place.city}, {place.stateAbbr} · {zip}
              </Text>
            ) : null}
          </View>

          {/* 1. What's on the ballot */}
          <Section title="What you're voting for" />
          {ballot.length === 0 ? (
            <View style={[styles.card, styles.cardInset]}>
              <Text style={styles.cardTitle}>We can&rsquo;t confirm your ballot yet</Text>
              <Text style={styles.cardBody}>
                Add your ZIP code in Profile and we&rsquo;ll show the federal offices you vote on.
              </Text>
            </View>
          ) : (
            ballot.map((office) => (
              <OfficeCard
                key={office.office}
                office={office}
                onOpenIncumbent={
                  office.incumbent
                    ? () => router.push(`/representative/${office.incumbent!.id}`)
                    : undefined
                }
              />
            ))
          )}

          <View style={[styles.gapNotice, styles.cardInset]}>
            <Text style={styles.gapTitle}>This is not your whole ballot</Text>
            <Text style={styles.gapBody}>
              These are the federal offices we can confirm from the public record. Your real ballot
              will also carry state and local races, judges, and ballot questions that we
              don&rsquo;t yet have an authoritative source for — so we don&rsquo;t list them rather
              than show you a partial ballot that looks complete.
            </Text>
            <Pressable
              style={styles.gapBtn}
              onPress={() => Linking.openURL("https://www.usa.gov/election-office")}
              accessibilityRole="link"
            >
              <Text style={styles.gapBtnText}>Find your election office</Text>
              <ExternalLink size={13} color="#fff" strokeWidth={2.4} />
            </Pressable>
          </View>

          {/* 2. How the booth works */}
          <Section
            title="In the booth"
            subtitle="The parts nobody explains, and the rules you're allowed to use."
          />
          {BOOTH_NOTES.map((n) => (
            <View key={n.title} style={[styles.boothRow, styles.cardInset]}>
              <CheckCircle2 size={17} color={color.brand.civicTeal} strokeWidth={2.2} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.boothTitle}>{n.title}</Text>
                <Text style={styles.boothBody}>{n.body}</Text>
              </View>
            </View>
          ))}

          {/* 3. Ballot language */}
          <Section
            title="Words you'll see on the paper"
            subtitle="Ballot language, in the words you'd actually use."
          />
          {BALLOT_TERMS.map((t) => (
            <View key={t.term} style={[styles.card, styles.cardInset]}>
              <Text style={styles.termName}>{t.term}</Text>
              <Text style={styles.cardBody}>{t.plain}</Text>
            </View>
          ))}

          <Text style={styles.footnote}>
            Registration deadlines, polling places and what appears on your specific ballot are set
            by your state and county. Their election office is the only authoritative source, and
            Politick doesn&rsquo;t replace it.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Section({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
    </View>
  );
}

function OfficeCard({
  office,
  onOpenIncumbent,
}: {
  office: BallotOffice;
  onOpenIncumbent?: () => void;
}) {
  return (
    <View style={[styles.officeCard, styles.cardInset]}>
      <Text style={styles.officeName}>{office.office}</Text>
      <Text style={styles.officeSeat}>{office.seat}</Text>

      <View style={styles.plainBox}>
        <Text style={styles.plainLabel}>WHAT YOU&rsquo;RE DECIDING</Text>
        <Text style={styles.plainBody}>{office.plainVote}</Text>
      </View>

      <Text style={styles.officeControls}>{office.controls}</Text>

      {/* The whole point of seeing this before election day: the seat is
          abstract, the record of the person in it is not. */}
      {office.incumbent && onOpenIncumbent ? (
        <Pressable
          style={styles.incumbentBtn}
          onPress={onOpenIncumbent}
          accessibilityRole="button"
          accessibilityLabel={`See how ${office.incumbent.name} has voted`}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.incumbentLabel}>{office.incumbentNote}</Text>
            <Text style={styles.incumbentName} numberOfLines={1}>
              {office.incumbent.name}
            </Text>
            <Text style={styles.incumbentHint}>See how they&rsquo;ve voted and what they sponsored</Text>
          </View>
          <ChevronRight size={17} color={color.brand.deepTeal} strokeWidth={2.2} />
        </Pressable>
      ) : (
        <Text style={styles.officeIncumbent}>{office.incumbentNote}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.light.canvas },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  appbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 56, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: color.light.border, backgroundColor: color.light.surface },
  appbarTitle: { fontSize: 14, fontWeight: "700", color: color.light.ink },

  // The one screen with its own dark ground, matching how Election Center is
  // set apart everywhere else in the product.
  hero: { backgroundColor: color.brand.deepTeal, paddingVertical: 28, paddingHorizontal: 20, alignItems: "center" },
  heroYear: { fontSize: 10.5, fontWeight: "800", letterSpacing: 1, color: color.brand.signalGold },
  heroDays: { fontSize: 56, lineHeight: 62, fontWeight: "800", color: "#fff" },
  heroDaysLabel: { fontSize: 13.5, fontWeight: "600", color: "rgba(255,255,255,0.9)" },
  heroDate: { fontSize: 12.5, color: "rgba(255,255,255,0.72)", marginTop: 6 },
  heroPlace: { fontSize: 12, color: color.brand.signalGold, marginTop: 10, fontWeight: "700" },

  sectionHead: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: color.light.ink },
  sectionSub: { fontSize: 13, color: color.light.muted, marginTop: 4, lineHeight: 18 },

  cardInset: { marginHorizontal: 20, marginBottom: 10 },
  card: { backgroundColor: color.light.surface, borderWidth: 1, borderColor: color.light.border, borderRadius: radius.card, padding: 15 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: color.light.ink, marginBottom: 4 },
  cardBody: { fontSize: 13, lineHeight: 19, color: color.light.muted },

  officeCard: { backgroundColor: color.light.surface, borderWidth: 1, borderColor: color.light.border, borderRadius: radius.card, padding: 16 },
  officeName: { fontSize: 15.5, fontWeight: "800", color: color.light.ink },
  officeSeat: { fontSize: 12.5, color: color.brand.deepTeal, fontWeight: "700", marginTop: 2 },
  plainBox: { backgroundColor: color.brand.softTeal, borderRadius: 12, padding: 13, marginTop: 12 },
  plainLabel: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.5, color: color.brand.deepTeal, marginBottom: 5 },
  plainBody: { fontSize: 13.5, lineHeight: 19.5, color: color.light.ink },
  officeControls: { fontSize: 12.5, lineHeight: 18, color: color.light.muted, marginTop: 12 },
  officeIncumbent: { fontSize: 12, color: color.light.muted, marginTop: 8, fontStyle: "italic" },
  incumbentBtn: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: color.light.border },
  incumbentLabel: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.3, color: color.light.muted, textTransform: "uppercase" },
  incumbentName: { fontSize: 14.5, fontWeight: "800", color: color.light.ink, marginTop: 2 },
  incumbentHint: { fontSize: 11.5, color: color.brand.deepTeal, fontWeight: "600", marginTop: 3 },

  gapNotice: { backgroundColor: color.brand.warmSand, borderRadius: radius.card, padding: 16, marginTop: 4 },
  gapTitle: { fontSize: 14, fontWeight: "800", color: color.light.ink, marginBottom: 6 },
  gapBody: { fontSize: 12.5, lineHeight: 18.5, color: color.light.ink },
  gapBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: color.brand.deepTeal, borderRadius: radius.button, height: 44, marginTop: 14 },
  gapBtnText: { color: "#fff", fontWeight: "700", fontSize: 13.5 },

  boothRow: { flexDirection: "row", gap: 11, backgroundColor: color.light.surface, borderWidth: 1, borderColor: color.light.border, borderRadius: radius.card, padding: 15 },
  boothTitle: { fontSize: 13.5, fontWeight: "700", color: color.light.ink, marginBottom: 4 },
  boothBody: { fontSize: 12.5, lineHeight: 18.5, color: color.light.muted },

  termName: { fontSize: 13.5, fontWeight: "800", color: color.brand.deepTeal, marginBottom: 5 },

  footnote: { fontSize: 11.5, lineHeight: 17, color: color.light.muted, paddingHorizontal: 20, paddingTop: 18 },
});
