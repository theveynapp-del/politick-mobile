import { View, Pressable, Modal, ScrollView, StyleSheet } from "react-native";
import { Text } from "@/components/Text";
import { X } from "lucide-react-native";
import { JargonTerm } from "@/lib/jargon";
import { BillStage, whatHappensNext } from "@/lib/billStage";

/**
 * The definition sheet, in the spec's three-part shape: what it means, why
 * you're seeing it, what happens next.
 *
 * Every part is either a reviewed definition from the term library or the
 * verbatim action text from the record. Nothing here is generated, so there is
 * no path by which this can assert something the source doesn't say.
 */
export function JargonSheet({
  term,
  contextSentence,
  stage,
  onClose,
}: {
  term: JargonTerm | null;
  contextSentence: string | null;
  stage: BillStage | null;
  onClose: () => void;
}) {
  const next = whatHappensNext(stage);

  return (
    <Modal visible={!!term} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {term ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.category}>{term.category.toUpperCase()}</Text>
                  <Text style={styles.term}>{term.term}</Text>
                </View>
                <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
                  <X size={22} color="#5D6670" strokeWidth={2} />
                </Pressable>
              </View>

              <Text style={styles.blockLabel}>WHAT IT MEANS</Text>
              <Text style={styles.lead}>{term.shortDefinition}</Text>
              <Text style={styles.body}>{term.expandedDefinition}</Text>

              {contextSentence ? (
                <>
                  <Text style={styles.blockLabel}>WHY YOU'RE SEEING IT</Text>
                  <Text style={styles.body}>{contextSentence}</Text>
                </>
              ) : null}

              {next ? (
                <>
                  <Text style={styles.blockLabel}>WHAT HAPPENS NEXT</Text>
                  <Text style={styles.body}>{next}</Text>
                </>
              ) : null}

              {term.relatedTerms.length > 0 ? (
                <>
                  <Text style={styles.blockLabel}>RELATED</Text>
                  <View style={styles.related}>
                    {term.relatedTerms.map((r) => (
                      <View key={r} style={styles.relatedChip}>
                        <Text style={styles.relatedText}>{r}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              <Text style={styles.source}>Definitions follow the congressional glossary at congress.gov.</Text>
            </ScrollView>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(16,20,24,0.4)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "82%",
    padding: 22,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#FFFFFF",
  },
  header: { flexDirection: "row", alignItems: "flex-start", columnGap: 12, marginBottom: 6 },
  category: { fontSize: 10.5, lineHeight: 14, fontWeight: "700", letterSpacing: 0.4, color: "#8A929A" },
  term: { marginTop: 3, fontSize: 24, lineHeight: 30, fontWeight: "700", letterSpacing: -0.4, color: "#101418" },
  blockLabel: { marginTop: 18, fontSize: 10.5, lineHeight: 14, fontWeight: "700", letterSpacing: 0.5, color: "#0D5F5B" },
  lead: { marginTop: 6, fontSize: 16, lineHeight: 23, fontWeight: "600", color: "#101418" },
  body: { marginTop: 6, fontSize: 14.5, lineHeight: 22, color: "#41484F" },
  related: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  relatedChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: "#EEF4F2" },
  relatedText: { fontSize: 12.5, lineHeight: 17, fontWeight: "600", color: "#0D5F5B" },
  source: { marginTop: 22, marginBottom: 8, fontSize: 11.5, lineHeight: 16, color: "#8A929A" },
});
