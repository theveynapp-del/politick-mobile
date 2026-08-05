import { View, Text, StyleSheet } from "react-native";
import { color, radius } from "@/lib/tokens";
import { SourceType } from "@/lib/types";

/** Badge/Source */
export function SourceBadge({ type }: { type: SourceType }) {
  return (
    <View style={styles.sourceBadge}>
      <Text style={styles.sourceBadgeText}>{type}</Text>
    </View>
  );
}

/** Badge/Topic */
export function TopicBadge({ children }: { children: string }) {
  return (
    <View style={styles.topicBadge}>
      <Text style={styles.topicBadgeText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sourceBadge: {
    backgroundColor: color.brand.softTeal,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sourceBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: color.brand.deepTeal,
  },
  topicBadge: {
    backgroundColor: color.light.border,
    borderRadius: radius.chip,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  topicBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: color.light.ink,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});
