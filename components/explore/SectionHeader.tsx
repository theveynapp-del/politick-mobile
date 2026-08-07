import { View, Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/Text";

/**
 * The heading row every Explore section uses. Exists so the title/subtitle/
 * action rhythm is defined once rather than drifting between sections.
 */
export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  gutter,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  gutter: number;
}) {
  return (
    <View style={[styles.wrap, { paddingHorizontal: gutter }]}>
      <View style={styles.row}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${actionLabel}: ${title}`}>
            <Text style={styles.action}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { flex: 1, minWidth: 0, fontSize: 17, lineHeight: 23, fontWeight: "700", letterSpacing: -0.3, color: "#101418" },
  action: { fontSize: 12.5, lineHeight: 17, fontWeight: "600", color: "#0D5F5B" },
  subtitle: { marginTop: 3, fontSize: 12, lineHeight: 17, fontWeight: "400", color: "#5D6670" },
});
