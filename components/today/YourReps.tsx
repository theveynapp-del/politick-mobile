import { View, Image, Pressable, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { UserRound } from "lucide-react-native";
import { Text } from "@/components/Text";
import { Representative } from "@/lib/types";

/**
 * A preview strip of the reader's own officials. The Representatives tab is
 * the real destination — this only surfaces a cross-section and links there.
 */

const OFFICE_LABELS: Record<string, string> = {
  "US Senator": "U.S. Senate",
  "US House representative": "U.S. House",
};

function officeLabel(rep: Representative): string {
  return OFFICE_LABELS[rep.role] ?? rep.role;
}

/**
 * The reference shows a district line ("MD-08"). Cicero and 5 Calls don't give
 * us district numbers, and the municipality isn't stored either, so this shows
 * the jurisdiction we can actually stand behind rather than inventing one.
 */
function jurisdictionLine(rep: Representative, stateName: string | null): string {
  if (stateName) return stateName;
  return rep.level === "Federal" ? "United States" : "Your area";
}

/**
 * Sorted lists put every statewide executive first, which would fill the strip
 * with six state officials and no member of Congress. Leading with one per
 * level makes the preview show the reader's actual range of representation.
 */
export function previewOrder(reps: Representative[]): Representative[] {
  const seen = new Set<string>();
  const lead: Representative[] = [];
  for (const level of ["Federal", "State", "Local"] as const) {
    const first = reps.find((r) => r.level === level);
    if (first) {
      lead.push(first);
      seen.add(first.id);
    }
  }
  return [...lead, ...reps.filter((r) => !seen.has(r.id))].slice(0, 8);
}

export function YourReps({
  reps,
  stateName,
  gutter,
}: {
  reps: Representative[];
  stateName: string | null;
  gutter: number;
}) {
  const router = useRouter();
  // Nothing resolved for this ZIP yet — better to show no module than an
  // empty shell implying the reader has no representatives.
  if (reps.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <Text style={styles.title} accessibilityRole="header">
          Your reps
        </Text>
        <Pressable
          onPress={() => router.push("/reps")}
          hitSlop={10}
          accessibilityRole="link"
          accessibilityLabel="View all your representatives"
        >
          <Text style={styles.viewAll}>View all</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.strip, { paddingHorizontal: gutter }]}
      >
        {previewOrder(reps).map((rep) => (
          <Pressable
            key={rep.id}
            onPress={() => router.push(`/representative/${rep.id}`)}
            accessibilityRole="link"
            accessibilityLabel={`${rep.name}, ${officeLabel(rep)}, ${jurisdictionLine(rep, stateName)}`}
            style={styles.repCard}
          >
            {rep.photoUrl ? (
              <Image
                source={{ uri: rep.photoUrl }}
                style={styles.portrait}
                accessibilityLabel=""
              />
            ) : (
              <View style={[styles.portrait, styles.portraitEmpty]}>
                <UserRound size={22} color="#8A929A" strokeWidth={1.8} />
              </View>
            )}

            <View style={styles.repText}>
              <Text style={styles.repOffice} numberOfLines={1}>
                {officeLabel(rep)}
              </Text>
              <Text style={styles.repName} numberOfLines={2}>
                {rep.name}
              </Text>
              <Text style={styles.repJurisdiction} numberOfLines={1}>
                {jurisdictionLine(rep, stateName)}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 26 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 16, lineHeight: 22, fontWeight: "700", color: "#101418" },
  viewAll: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: "#167D79" },

  strip: { paddingTop: 12, columnGap: 10 },
  repCard: {
    width: 168,
    height: 96,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  portrait: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#EEE9DE" },
  portraitEmpty: { alignItems: "center", justifyContent: "center" },
  repText: { flex: 1, minWidth: 0 },
  repOffice: { fontSize: 11, lineHeight: 15, fontWeight: "600", letterSpacing: 0.2, color: "#5D6670" },
  repName: { marginTop: 1, fontSize: 13.5, lineHeight: 17, fontWeight: "700", letterSpacing: -0.15, color: "#101418" },
  repJurisdiction: { marginTop: 1, fontSize: 11, lineHeight: 15, fontWeight: "400", color: "#5D6670" },
});
