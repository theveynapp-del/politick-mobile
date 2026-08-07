import { View, Image, Pressable, StyleSheet, Linking } from "react-native";
import { Text } from "@/components/Text";
import { ChevronRight, ExternalLink, UserRound, Plus, FileText, HelpCircle } from "lucide-react-native";
import { BillStage, stageFromAction } from "@/lib/billStage";
import { GovActivityItem } from "@/lib/govActivity";
import { JargonTerm } from "@/lib/jargon";

export const CARD_WIDTH = 305;

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
  onPress,
}: {
  item: GovActivityItem;
  repName: string | null;
  repPhoto: string | null;
  onPress: () => void;
}) {
  const stage = stageFromAction(item.latestAction);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${item.citation}, ${item.title}. Opens congress.gov.`}
      style={styles.govCard}
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
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.issueChip}>
      <Text style={styles.issueChipText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Election Center fails closed. Ballot data has no source yet, so this states
 * that plainly instead of rendering an empty shell that implies coverage.
 */
export function ElectionCenterCard({ placeLabel, gutter }: { placeLabel: string | null; gutter: number }) {
  return (
    <View style={{ paddingHorizontal: gutter }}>
      <View style={styles.electionCard}>
        <Text style={styles.electionTitle}>Your election center</Text>
        <Text style={styles.electionBody}>
          {placeLabel
            ? `No supported election information is available for ${placeLabel} right now.`
            : "No supported election information is available for your location right now."}
        </Text>
        <Text style={styles.electionNote}>
          We'll turn this on when we can source a complete ballot for your area.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 10.5, lineHeight: 14, fontWeight: "700", letterSpacing: 0.4, color: "#0D5F5B" },
  microLabel: { fontSize: 9.5, lineHeight: 13, fontWeight: "700", letterSpacing: 0.4, color: "#8A929A" },
  microValue: { marginTop: 4, fontSize: 11.5, lineHeight: 15, color: "#41484F" },

  govCard: {
    width: CARD_WIDTH,
    padding: 14,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  govTitle: { marginTop: 6, fontSize: 16.5, lineHeight: 21, fontWeight: "700", letterSpacing: -0.2, color: "#101418" },
  govCitation: { marginTop: 4, fontSize: 12, lineHeight: 16, color: "#5D6670" },
  govFooter: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#E7E9EC", flexDirection: "row" },
  govFooterCol: { flex: 1, minWidth: 0 },
  govFooterDivider: { width: 1, marginHorizontal: 10, backgroundColor: "#E7E9EC" },
  stageBadge: { marginTop: 5, alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: "#DCEFED" },
  stageBadgeText: { fontSize: 11.5, lineHeight: 15, fontWeight: "700", color: "#0D5F5B" },
  repRow: { marginTop: 5, flexDirection: "row", alignItems: "center", columnGap: 7 },
  repAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#EEE9DE" },
  repAvatarEmpty: { alignItems: "center", justifyContent: "center" },
  repName: { fontSize: 12, lineHeight: 16, fontWeight: "700", color: "#101418" },
  repRelationship: { fontSize: 11, lineHeight: 15, color: "#5D6670" },
  govCta: { marginTop: 12, flexDirection: "row", alignItems: "center", columnGap: 5 },
  govCtaText: { fontSize: 13.5, lineHeight: 18, fontWeight: "700", color: "#0D5F5B" },

  officialCard: {
    width: CARD_WIDTH,
    padding: 14,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  officialHeader: { flexDirection: "row", alignItems: "center", columnGap: 10 },
  officialAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#EEE9DE" },
  officialName: { fontSize: 16, lineHeight: 21, fontWeight: "700", letterSpacing: -0.2, color: "#101418" },
  officialOffice: { marginTop: 1, fontSize: 12, lineHeight: 17, color: "#5D6670" },
  officialEmpty: { marginTop: 12, fontSize: 12.5, lineHeight: 17, color: "#5D6670" },
  activityRow: { marginTop: 12, flexDirection: "row", columnGap: 9 },
  activityIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#DCEFED", alignItems: "center", justifyContent: "center" },
  activityTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 8 },
  activityAction: { fontSize: 12.5, lineHeight: 17, fontWeight: "700", color: "#101418" },
  activityDate: { fontSize: 11, lineHeight: 15, color: "#8A929A" },
  activityTitle: { marginTop: 1, fontSize: 12, lineHeight: 16, color: "#5D6670" },

  learnCard: {
    padding: 15,
    flexDirection: "row",
    columnGap: 12,
    borderWidth: 1,
    borderColor: "rgba(22,125,121,0.18)",
    borderRadius: 16,
    backgroundColor: "#F3FAF8",
  },
  learnTitle: { fontSize: 15.5, lineHeight: 21, fontWeight: "700", letterSpacing: -0.15, color: "#101418" },
  learnContext: { marginTop: 4, fontSize: 13, lineHeight: 18, color: "#41484F" },
  learnCta: { marginTop: 8, flexDirection: "row", alignItems: "center", columnGap: 3 },
  learnCtaText: { fontSize: 13, lineHeight: 18, fontWeight: "700", color: "#0D5F5B" },

  issueChip: {
    height: 39,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    backgroundColor: "#FFFFFF",
  },
  issueChipText: { fontSize: 13.5, lineHeight: 18, fontWeight: "600", color: "#252B30" },

  electionCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  electionTitle: { fontSize: 16, lineHeight: 21, fontWeight: "700", color: "#101418" },
  electionBody: { marginTop: 6, fontSize: 13, lineHeight: 19, color: "#41484F" },
  electionNote: { marginTop: 6, fontSize: 12, lineHeight: 17, color: "#8A929A" },
});
