import { useState } from "react";
import { View, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Bookmark, Clock, FileText, ChevronRight, UserRound } from "lucide-react-native";
import { Text } from "@/components/Text";
import { StoryPlaceholder } from "@/components/StoryPlaceholder";
import { topicImageFor } from "@/lib/topicImages";
import { estimateReadMinutes } from "@/lib/readTime";
import { hasPolicyDetail, relevanceFor } from "@/lib/storyMeta";
import { Story } from "@/lib/types";

/**
 * The Today feed card.
 *
 * Deliberately kept out of components/StoryCard.tsx: that one is still used by
 * Saved, which hasn't had a fidelity pass, and restyling it here would change
 * that screen without anyone having reviewed it.
 */

/** "image" uses real photography; "fallback" uses the Politick placeholder;
 *  "none" drops the media column and lets the copy run the full card width. */
export type MediaVariant = "image" | "fallback" | "none";

export function StoryCard({
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
  const mediaSize = tight ? 96 : 100;

  // Three tiers, most specific first: the story's own photograph, then a real
  // photo for its topic, then the Politick placeholder.
  const [remoteFailed, setRemoteFailed] = useState(false);
  const remote = !remoteFailed && story.imageUrl ? story.imageUrl : null;
  const topical = remote ? null : topicImageFor(story.topic);
  // Today always shows media; "none" exists for callers that want the copy to
  // run full width rather than leaving an empty column.
  const variant = (remote || topical ? "image" : "fallback") as MediaVariant;

  const relevance = relevanceFor(story);
  const goDeeper = hasPolicyDetail(story);
  const sourceCount = story.sources.length;
  // Local coverage gets the restrained gold; everything else stays slate, so
  // scope is never signalled by colour alone — the label itself always says it.
  const scopeColor = story.scope === "Local" ? "#9A7419" : "#5D6670";

  return (
    <Pressable
      onPress={() => router.push(`/story/${story.id}`)}
      style={[styles.card, tight && styles.cardTight]}
      // "link", not "button": the card contains its own bookmark button, and RN
      // Web renders role=button as a real <button>, which cannot nest another.
      accessibilityRole="link"
      accessibilityLabel={story.headline}
    >
      <View style={styles.top}>
        <Text style={[styles.scope, { color: scopeColor }]} numberOfLines={1}>
          {story.scope.toUpperCase()} · {story.topic}
        </Text>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onToggleSave();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityState={{ selected: saved }}
          accessibilityLabel={saved ? `Remove ${story.headline} from saved` : `Save ${story.headline}`}
          style={styles.bookmark}
        >
          <Bookmark size={22} color="#252B30" strokeWidth={1.8} fill={saved ? "#252B30" : "none"} />
        </Pressable>
      </View>

      <View style={[styles.body, variant === "none" && styles.bodyNoMedia]}>
        <View style={styles.copy}>
          <Text style={styles.headline} numberOfLines={3}>
            {story.headline}
          </Text>
          <Text style={styles.summary} numberOfLines={2}>
            {story.whatHappened}
          </Text>
        </View>

        {variant === "image" ? (
          <Image
            source={remote ? { uri: remote } : topical!}
            style={[styles.media, { width: mediaSize, height: mediaSize }]}
            resizeMode="cover"
            onError={() => setRemoteFailed(true)}
            accessibilityLabel={
              remote ? `Photograph accompanying: ${story.headline}` : `${story.topic} — illustrative photograph`
            }
          />
        ) : variant === "fallback" ? (
          <StoryPlaceholder style={[styles.media, { width: mediaSize, height: mediaSize }]} />
        ) : null}
      </View>

      <View style={styles.why}>
        <UserRound size={18} color="#167D79" strokeWidth={1.9} style={styles.whyIcon} />
        <Text style={styles.whyText} numberOfLines={2}>
          <Text style={styles.whyPrefix}>{relevance.label} </Text>
          {relevance.text}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerMeta}>
          <Clock size={14} color="#5D6670" strokeWidth={1.9} />
          <Text style={styles.footerText}>{estimateReadMinutes(story)} min read</Text>
        </View>
        <View style={styles.footerDot} />
        <View style={styles.footerMeta}>
          <FileText size={14} color="#5D6670" strokeWidth={1.9} />
          <Text style={styles.footerText}>
            {sourceCount} {sourceCount === 1 ? "source" : "sources"}
          </Text>
        </View>

        <View style={styles.footerSpacer} />

        {goDeeper ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              router.push(`/story/${story.id}?mode=deeper`);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Go deeper on ${story.headline}`}
            hitSlop={8}
            style={styles.goDeeper}
          >
            <Text style={styles.goDeeperText}>Go deeper</Text>
            <ChevronRight size={15} color="#B84E3C" strokeWidth={2.2} />
          </Pressable>
        ) : (
          <ChevronRight size={20} color="#5D6670" strokeWidth={1.9} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
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
  cardTight: { padding: 14 },

  top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  scope: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: "700", letterSpacing: 0.2 },
  // Pulled out of flow so the 44px target doesn't add height to the row.
  bookmark: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "flex-start", marginTop: -12, marginRight: -8, marginBottom: -22 },

  body: { marginTop: 8, flexDirection: "row", alignItems: "flex-start", columnGap: 14 },
  bodyNoMedia: { flexDirection: "column" },
  copy: { flex: 1, minWidth: 0 },
  headline: { fontSize: 20, lineHeight: 26, fontWeight: "700", letterSpacing: -0.25, color: "#101418" },
  summary: { marginTop: 8, fontSize: 15, lineHeight: 22, fontWeight: "400", color: "#5D6670" },
  media: { borderRadius: 12, backgroundColor: "#EEE9DE" },

  why: { marginTop: 12, flexDirection: "row", alignItems: "flex-start", columnGap: 8 },
  whyIcon: { marginTop: 1 },
  whyText: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 20, fontWeight: "400", color: "#252B30" },
  whyPrefix: { fontWeight: "700", color: "#0D5F5B" },

  footer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#DDE1E5",
    flexDirection: "row",
    alignItems: "center",
  },
  footerMeta: { flexDirection: "row", alignItems: "center", columnGap: 5 },
  footerText: { fontSize: 13, lineHeight: 18, fontWeight: "400", color: "#5D6670" },
  footerDot: { width: 1, height: 12, marginHorizontal: 10, backgroundColor: "#DDE1E5" },
  footerSpacer: { flex: 1 },

  goDeeper: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 2,
    height: 30,
    paddingLeft: 11,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: "#B84E3C",
    borderRadius: 999,
  },
  goDeeperText: { fontSize: 14, lineHeight: 18, fontWeight: "600", color: "#B84E3C" },
});
