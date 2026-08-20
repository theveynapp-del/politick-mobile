import { View, Image, Pressable, StyleSheet, Linking } from "react-native";
import { Text } from "@/components/Text";
import { ChevronRight, ExternalLink, UserRound, Plus, FileText, HelpCircle, MapPin } from "lucide-react-native";
import { ISSUE_META } from "@/lib/issueIcons";
import { BillStage, stageFromAction } from "@/lib/billStage";
import { GovActivityItem } from "@/lib/govActivity";
import { JargonTerm } from "@/lib/jargon";
import { BallotOffice, daysUntilElection } from "@/lib/election";

export const CARD_WIDTH = 288;

/**
 * The stage a bill has reached, read from its official latest action. Renders
 * nothing when the action text isn't recognised — an unlabelled card is better
 * than a confidently wrong stage.
 */
export function BillStageBadge({ stage }: { stage: BillStage | null }) {
  if (!stage) return null;
  return (
    <View style={styles.stageBadge}>
      <Text style={styles.stageBadgeText}>{stage}</Text>
    </View>
  );
}

/** "sponsored" / "cosponsored" only — factual record labels, never "backed". */
function relationshipLabel(item: GovActivityItem): string {
  return item.relationshipType === "sponsored" ? "Sponsor" : "Cosponsor";
}

export function GovernmentActivityCard({
  item,
  repName,
  repPhoto,
  fullWidth,
  onPress,
}: {
  item: GovActivityItem;
  repName: string | null;
  repPhoto: string | null;
  fullWidth?: boolean;
  onPress: () => void;
}) {
  const stage = stageFromAction(item.latestAction);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${item.citation}, ${item.title}. Opens congress.gov.`}
      style={[styles.govCard, fullWidth && styles.govCardFull]}
    >
      <Text style={styles.eyebrow} numberOfLines={1}>
        FEDERAL{item.policyArea ? ` · ${item.policyArea.toUpperCase()}` : ""}
      </Text>
      <Text style={styles.govTitle} numberOfLines={3}>
        {item.title}
      </Text>
      <Text style={styles.govCitation}>{item.citation}</Text>

      <View style={styles.govFooter}>
        <View style={styles.govFooterCol}>
          <Text style={styles.microLabel}>CURRENT STAGE</Text>
          {stage ? (
            <BillStageBadge stage={stage} />
          ) : (
            <Text style={styles.microValue} numberOfLines={2}>
              {item.latestAction ?? "Not available"}
            </Text>
          )}
        </View>

        <View style={styles.govFooterDivider} />

        <View style={styles.govFooterCol}>
          <Text style={styles.microLabel}>YOUR REPRESENTATIVE</Text>
          <View style={styles.repRow}>
            {repPhoto ? (
              <Image source={{ uri: repPhoto }} style={styles.repAvatar} accessibilityLabel="" />
            ) : (
              <View style={[styles.repAvatar, styles.repAvatarEmpty]}>
                <UserRound size={13} color="#8A929A" strokeWidth={1.9} />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.repName} numberOfLines={1}>
                {repName ?? "Your member"}
              </Text>
              <Text style={styles.repRelationship}>{relationshipLabel(item)}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.govCta}>
        <Text style={styles.govCtaText}>View bill</Text>
        <ExternalLink size={14} color="#0D5F5B" strokeWidth={2} />
      </View>
    </Pressable>
  );
}

export function OfficialActivityCard({
  name,
  office,
  photoUrl,
  items,
  onPressItem,
}: {
  name: string;
  office: string;
  photoUrl: string | null;
  items: GovActivityItem[];
  onPressItem: (item: GovActivityItem) => void;
}) {
  return (
    <View style={styles.officialCard}>
      <View style={styles.officialHeader}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.officialAvatar} accessibilityLabel="" />
        ) : (
          <View style={[styles.officialAvatar, styles.repAvatarEmpty]}>
            <UserRound size={20} color="#8A929A" strokeWidth={1.9} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.officialName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.officialOffice} numberOfLines={1}>
            {office}
          </Text>
        </View>
      </View>

      {items.length === 0 ? (
        <Text style={styles.officialEmpty}>No recorded legislative activity in this window.</Text>
      ) : (
        items.slice(0, 2).map((item, i) => (
          <Pressable
            key={`${item.citation}-${i}`}
            onPress={() => onPressItem(item)}
            accessibilityRole="link"
            accessibilityLabel={`${relationshipLabel(item)} ${item.citation}, ${item.title}`}
            style={styles.activityRow}
          >
            <View style={styles.activityIcon}>
              {item.relationshipType === "sponsored" ? (
                <FileText size={13} color="#0D5F5B" strokeWidth={2} />
              ) : (
                <Plus size={13} color="#0D5F5B" strokeWidth={2.4} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.activityTop}>
                <Text style={styles.activityAction}>
                  {item.relationshipType === "sponsored" ? "Introduced" : "Cosponsored"}
                </Text>
                {item.latestActionDate ? (
                  <Text style={styles.activityDate}>{item.latestActionDate}</Text>
                ) : null}
              </View>
              <Text style={styles.activityTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </View>
  );
}

/**
 * A term the reader is currently looking at, not a term picked at random —
 * the context sentence is the real action text from a real bill.
 */
export function ContextLearningCard({
  term,
  contextSentence,
  onPress,
  gutter,
}: {
  term: JargonTerm;
  contextSentence: string;
  onPress: () => void;
  gutter: number;
}) {
  return (
    <View style={{ paddingHorizontal: gutter }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Learn what ${term.term} means`}
        style={styles.learnCard}
      >
        <HelpCircle size={22} color="#0D5F5B" strokeWidth={1.9} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.learnTitle}>What does “{term.term}” mean?</Text>
          <Text style={styles.learnContext} numberOfLines={3}>
            {contextSentence}
          </Text>
          <View style={styles.learnCta}>
            <Text style={styles.learnCtaText}>Learn more</Text>
            <ChevronRight size={15} color="#0D5F5B" strokeWidth={2.2} />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

export function IssueChip({ label, onPress }: { label: string; onPress: () => void }) {
  const meta = ISSUE_META[label];
  const Icon = meta?.icon;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.issueChip}>
      {Icon ? <Icon size={15} color={meta.color} strokeWidth={2} /> : null}
      <Text style={styles.issueChipText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Election Center.
 *
 * Shows the offices on the reader's ballot and what each one decides. It shows
 * no candidates, because we have no entitled ballot source — and a partial
 * candidate list is worse than none. The card says so rather than implying the
 * ballot below it is complete.
 */
export function ElectionCenterCard({
  placeLabel,
  cycleYear,
  ballot,
  gutter,
}: {
  placeLabel: string | null;
  cycleYear: string;
  ballot: BallotOffice[];
  gutter: number;
}) {
  const days = daysUntilElection();

  return (
    <View style={{ paddingHorizontal: gutter }}>
      <View style={styles.electionCard}>
        <View style={styles.electionHeader}>
          <View style={styles.electionCopy}>
            <View style={styles.electionTitleRow}>
              <Text style={styles.electionTitle}>Your election center</Text>
              <View style={styles.electionYear}>
                <Text style={styles.electionYearText}>{cycleYear}</Text>
              </View>
            </View>
            {placeLabel ? (
              <View style={styles.electionPlace}>
                <MapPin size={13} color="#41484F" strokeWidth={2} />
                <Text style={styles.electionPlaceText} numberOfLines={1}>
                  {placeLabel}
                </Text>
              </View>
            ) : null}
            <Text style={styles.electionCountdown}>
              {days > 0 ? `${days} days until Election Day, November 3` : "Election Day is today"}
            </Text>
          </View>

          <Image
            source={require("@/assets/explore/ballot.png")}
            style={styles.electionArt}
            resizeMode="contain"
            accessibilityLabel=""
          />
        </View>

        {ballot.length > 0 ? (
          <View style={styles.ballotList}>
            <Text style={styles.ballotHeading}>WHAT YOU'RE VOTING FOR</Text>
            {ballot.map((o, i) => (
              <View key={o.office} style={[styles.ballotRow, i > 0 && styles.ballotRowDivided]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.ballotOffice}>{o.office}</Text>
                  <Text style={styles.ballotSeat}>{o.seat}</Text>
                  <Text style={styles.ballotControls}>{o.controls}</Text>
                  <View style={styles.ballotIncumbent}>
                    {o.incumbent?.photoUrl ? (
                      <Image
                        source={{ uri: o.incumbent.photoUrl }}
                        style={styles.ballotAvatar}
                        accessibilityLabel=""
                      />
                    ) : null}
                    <Text style={styles.ballotIncumbentText} numberOfLines={1}>
                      {o.incumbent ? `${o.incumbentNote} ${o.incumbent.name}` : o.incumbentNote}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.electionNote}>
          Candidate lists and ballot measures aren't available yet. We'll add them when we can
          source a complete ballot for your area.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 10, lineHeight: 13, fontWeight: "700", letterSpacing: 0.4, color: "#0D5F5B" },
  microLabel: { fontSize: 9, lineHeight: 12, fontWeight: "700", letterSpacing: 0.4, color: "#8A929A" },
  microValue: { marginTop: 3, fontSize: 11, lineHeight: 14, color: "#41484F" },

  govCard: {
    width: CARD_WIDTH,
    padding: 13,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  govTitle: { marginTop: 5, fontSize: 14.5, lineHeight: 19, fontWeight: "700", letterSpacing: -0.2, color: "#101418" },
  govCitation: { marginTop: 3, fontSize: 11.5, lineHeight: 15, color: "#5D6670" },
  govFooter: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#E7E9EC", flexDirection: "row" },
  govFooterCol: { flex: 1, minWidth: 0 },
  govFooterDivider: { width: 1, marginHorizontal: 10, backgroundColor: "#E7E9EC" },
  stageBadge: { marginTop: 5, alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: "#DCEFED" },
  stageBadgeText: { fontSize: 11, lineHeight: 14, fontWeight: "700", color: "#0D5F5B" },
  repRow: { marginTop: 5, flexDirection: "row", alignItems: "center", columnGap: 7 },
  repAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#EEE9DE" },
  repAvatarEmpty: { alignItems: "center", justifyContent: "center" },
  repName: { fontSize: 11.5, lineHeight: 15, fontWeight: "700", color: "#101418" },
  repRelationship: { fontSize: 10.5, lineHeight: 14, color: "#5D6670" },
  govCta: { marginTop: 12, flexDirection: "row", alignItems: "center", columnGap: 5 },
  govCtaText: { fontSize: 12.5, lineHeight: 17, fontWeight: "700", color: "#0D5F5B" },

  govCardFull: { width: "100%" },
  officialCard: {
    width: CARD_WIDTH,
    padding: 14,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  officialHeader: { flexDirection: "row", alignItems: "center", columnGap: 10 },
  officialAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#EEE9DE" },
  officialName: { fontSize: 14.5, lineHeight: 19, fontWeight: "700", letterSpacing: -0.2, color: "#101418" },
  officialOffice: { marginTop: 1, fontSize: 11.5, lineHeight: 16, color: "#5D6670" },
  officialEmpty: { marginTop: 10, fontSize: 12, lineHeight: 16, color: "#5D6670" },
  activityRow: { marginTop: 12, flexDirection: "row", columnGap: 9 },
  activityIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#DCEFED", alignItems: "center", justifyContent: "center" },
  activityTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 8 },
  activityAction: { fontSize: 12, lineHeight: 16, fontWeight: "700", color: "#101418" },
  activityDate: { fontSize: 10.5, lineHeight: 14, color: "#8A929A" },
  activityTitle: { marginTop: 1, fontSize: 11.5, lineHeight: 15, color: "#5D6670" },

  learnCard: {
    padding: 15,
    flexDirection: "row",
    columnGap: 12,
    borderWidth: 1,
    borderColor: "rgba(22,125,121,0.18)",
    borderRadius: 16,
    backgroundColor: "#F3FAF8",
  },
  learnTitle: { fontSize: 14.5, lineHeight: 19, fontWeight: "700", letterSpacing: -0.15, color: "#101418" },
  learnContext: { marginTop: 4, fontSize: 12.5, lineHeight: 17, color: "#41484F" },
  learnCta: { marginTop: 8, flexDirection: "row", alignItems: "center", columnGap: 3 },
  learnCtaText: { fontSize: 12.5, lineHeight: 17, fontWeight: "700", color: "#0D5F5B" },

  issueChip: {
    height: 36,
    flexDirection: "row",
    columnGap: 6,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    backgroundColor: "#FFFFFF",
  },
  issueChipText: { fontSize: 12.5, lineHeight: 17, fontWeight: "600", color: "#252B30" },

  electionCard: {
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(79,109,122,0.20)",
    borderRadius: 16,
    backgroundColor: "#EDF2F9",
    overflow: "hidden",
  },
  electionHeader: { flexDirection: "row", alignItems: "center", columnGap: 10 },
  electionCopy: { flex: 1, minWidth: 0 },
  electionTitleRow: { flexDirection: "row", alignItems: "center", columnGap: 8 },
  electionTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: "700", letterSpacing: -0.2, color: "#101418" },
  electionYear: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: "#DBE6F3" },
  electionYearText: { fontSize: 11, lineHeight: 15, fontWeight: "700", color: "#3D5A78" },
  electionPlace: { marginTop: 4, flexDirection: "row", alignItems: "center", columnGap: 4 },
  electionPlaceText: { fontSize: 12, lineHeight: 16, fontWeight: "600", color: "#41484F" },
  electionCountdown: { marginTop: 5, fontSize: 12.5, lineHeight: 17, fontWeight: "600", color: "#3D5A78" },

  ballotList: { marginTop: 13, borderRadius: 12, backgroundColor: "#FFFFFF", paddingHorizontal: 13, paddingVertical: 4 },
  ballotHeading: { marginTop: 10, fontSize: 10, lineHeight: 14, fontWeight: "700", letterSpacing: 0.5, color: "#5D6670" },
  ballotRow: { paddingVertical: 11 },
  ballotRowDivided: { borderTopWidth: 1, borderTopColor: "#E7E9EC" },
  ballotOffice: { fontSize: 14, lineHeight: 19, fontWeight: "700", color: "#101418" },
  ballotSeat: { marginTop: 1, fontSize: 12, lineHeight: 16, fontWeight: "600", color: "#3D5A78" },
  ballotControls: { marginTop: 4, fontSize: 12, lineHeight: 17, color: "#5D6670" },
  ballotIncumbent: { marginTop: 7, flexDirection: "row", alignItems: "center", columnGap: 6 },
  ballotAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#EEE9DE" },
  ballotIncumbentText: { flex: 1, minWidth: 0, fontSize: 11.5, lineHeight: 16, color: "#41484F" },

  electionNote: { marginTop: 11, fontSize: 11.5, lineHeight: 16, fontWeight: "500", color: "#5D6670" },
  electionArt: { width: 76, height: 94, marginRight: 2 },
});
