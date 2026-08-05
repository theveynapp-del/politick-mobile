import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Bookmark } from "lucide-react-native";
import { color, radius } from "@/lib/tokens";
import { Story } from "@/lib/types";
import { storyImages } from "@/lib/storyImages";

const categoryColor: Record<Story["scope"], string> = {
  Local: "#795c17",
  State: "#43507c",
  Federal: color.brand.deepTeal,
  World: "#43507c",
};

/**
 * StoryCard — tappable card that navigates to the dedicated story detail
 * route (Everyday/Go Deeper live there now), matching the approved
 * reference board. No more inline expand on the feed card itself.
 */
export function StoryCard({
  story,
  saved,
  onToggleSave,
}: {
  story: Story;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const router = useRouter();
  const image = storyImages[story.id];

  return (
    <Pressable onPress={() => router.push(`/story/${story.id}`)} style={styles.card}>
      <View style={styles.topRow}>
        <Text style={[styles.topic, { color: categoryColor[story.scope] }]}>
          {story.scope.toUpperCase()} · {story.topic}
        </Text>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onToggleSave();
          }}
          hitSlop={8}
          accessibilityLabel={saved ? "Remove from saved" : "Save story"}
        >
          <Bookmark size={18} color={saved ? color.brand.deepTeal : color.light.muted} fill={saved ? color.brand.deepTeal : "none"} />
        </Pressable>
      </View>

      <View style={styles.bodyRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headline}>{story.headline}</Text>
          <Text style={styles.summary} numberOfLines={3}>
            {story.whatHappened}
          </Text>
        </View>
        {image && <Image source={image} style={styles.thumb} />}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>{story.updated}</Text>
        <Text style={styles.footerText}>{story.sources.length} sources →</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.light.surface, borderWidth: 1, borderColor: color.light.border, borderRadius: radius.card, padding: 16, marginHorizontal: 20, marginBottom: 14 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  topic: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.4 },
  bodyRow: { flexDirection: "row", gap: 12 },
  headline: { fontSize: 16.5, lineHeight: 21, fontWeight: "700", color: color.light.ink, marginBottom: 6 },
  summary: { fontSize: 13, lineHeight: 18, color: color.light.muted },
  thumb: { width: 76, height: 76, borderRadius: 12, backgroundColor: color.brand.softTeal },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: color.light.border },
  footerText: { fontSize: 11, color: color.light.muted },
});
