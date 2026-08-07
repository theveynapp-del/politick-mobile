import { useEffect, useState, useCallback } from "react";
import {
  View,
  Pressable,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronRight, ChevronDown, MapPin, Info, UserRound } from "lucide-react-native";
import { color } from "@/lib/tokens";
import { supabase } from "@/lib/supabase";
import { getRepresentativesByZip, getZipLocation, ZipLocation } from "@/lib/queries";
import { stateForZip } from "@/lib/zipToState";
import { Representative } from "@/lib/types";
import { GOV_LEVELS, GovLevel, tabForLevel, govLevelCopy, officeLine } from "@/lib/govLevels";
import { getStoredZip, setStoredZip } from "@/lib/onboarding";

const DEFAULT_ZIP = "20814";

export default function RepsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const gutter = width <= 380 ? 16 : 20;

  const [zip, setZip] = useState(DEFAULT_ZIP);
  const [place, setPlace] = useState<ZipLocation | null>(null);
  const [reps, setReps] = useState<Representative[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<GovLevel>("Federal");
  const [controlsOpen, setControlsOpen] = useState(true);
  const [changing, setChanging] = useState(false);
  const [draftZip, setDraftZip] = useState("");

  const load = useCallback(async (zipValue: string) => {
    setLoading(true);
    setZip(zipValue);
    setPlace(await getZipLocation(supabase, zipValue));
    const resolved = await getRepresentativesByZip(supabase, zipValue);
    setReps(resolved);
    // A cold ZIP has no location row until the lookup runs — that call creates
    // it, so re-read once it has finished.
    getZipLocation(supabase, zipValue).then((p) => p && setPlace(p));
    setLoading(false);
  }, []);

  useEffect(() => {
    getStoredZip().then((stored) => load(stored && stored.length === 5 ? stored : DEFAULT_ZIP));
  }, [load]);

  const stateName = place ? null : stateForZip(zip);
  const locationLine = [place ? `${place.city}, ${place.stateAbbr}` : stateName, zip]
    .filter(Boolean)
    .join(" · ");

  const copy = govLevelCopy(tab, place ? fullStateName(place.stateAbbr) : stateForZip(zip));
  const visible = reps.filter((r) => tabForLevel(r.level) === tab);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingHorizontal: gutter }]}>
          <View style={styles.titleRow}>
            <Image
              source={require("@/assets/politick-emblem.png")}
              style={styles.emblem}
              resizeMode="contain"
              accessibilityLabel=""
            />
            <Text style={styles.title} accessibilityRole="header">
              Your representatives
            </Text>
          </View>
          <View style={styles.locationRow}>
            <Text style={styles.location} numberOfLines={1}>
              {locationLine}
            </Text>
            <Pressable
              onPress={() => {
                setDraftZip(zip);
                setChanging(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Change your location"
              style={styles.changeButton}
            >
              <MapPin size={15} color="#167D79" strokeWidth={2} />
              <Text style={styles.changeText}>Change</Text>
            </Pressable>
          </View>
        </View>

        {/* Full-bleed: the white band and its divider run edge to edge in the
            reference, with only the labels sitting inside the thirds. */}
        <View style={styles.tabs} accessibilityRole="tablist">
          {GOV_LEVELS.map((level) => {
            const active = tab === level;
            return (
              <Pressable
                key={level}
                onPress={() => setTab(level)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={styles.tab}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{level}</Text>
                {/* Absolute so switching tabs never nudges the label, and it
                    sits on the divider rather than above it. */}
                {active ? <View style={styles.tabUnderline} /> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={{ paddingHorizontal: gutter }}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {copy.title}
          </Text>
          <Text style={styles.sectionDescription}>{copy.description}</Text>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={color.brand.deepTeal} />
          ) : visible.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {`We don't have ${tab.toLowerCase()} officials for ${zip} yet.`}
              </Text>
            </View>
          ) : (
            <View style={styles.group}>
              {visible.map((rep, i) => (
                <Pressable
                  key={rep.id}
                  onPress={() => router.push(`/representative/${rep.id}`)}
                  accessibilityRole="link"
                  accessibilityLabel={`${rep.name}, ${officeLine(rep.role, rep.district)}`}
                  style={styles.row}
                >
                  {rep.photoUrl ? (
                    <Image
                      source={{ uri: rep.photoUrl }}
                      style={styles.portrait}
                      accessibilityLabel={`Portrait of ${rep.name}`}
                    />
                  ) : (
                    <View style={[styles.portrait, styles.portraitEmpty]}>
                      <UserRound size={26} color="#8A929A" strokeWidth={1.8} />
                    </View>
                  )}

                  <View style={styles.rowText}>
                    <Text style={styles.rowLevel}>{tab}</Text>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {rep.name}
                    </Text>
                    <Text style={styles.rowOffice} numberOfLines={1}>
                      {officeLine(rep.role, rep.district)}
                    </Text>
                  </View>

                  <ChevronRight size={20} color="#5D6670" strokeWidth={2} />
                  {/* Inset to start after the portrait, per the reference. */}
                  {i < visible.length - 1 ? <View style={styles.rowDivider} /> : null}
                </Pressable>
              ))}
            </View>
          )}

          <Pressable
            onPress={() => setControlsOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: controlsOpen }}
            accessibilityLabel={`What does ${copy.title.toLowerCase()} control?`}
            style={styles.controlCard}
          >
            <View style={styles.controlHeader}>
              <Text style={styles.controlTitle}>What does {copy.title.toLowerCase()} control?</Text>
              <ChevronDown
                size={20}
                color="#5D6670"
                strokeWidth={2}
                style={controlsOpen ? undefined : styles.chevronCollapsed}
              />
            </View>

            {controlsOpen ? (
              <View style={styles.chips}>
                {copy.chips.map((chip) => (
                  <View key={chip} style={styles.chip}>
                    <Text style={styles.chipText}>{chip}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Pressable>

          <View style={styles.whyCard}>
            <Info size={22} color="#167D79" strokeWidth={1.9} />
            <View style={styles.whyText}>
              <Text style={styles.whyTitle}>Why this matters</Text>
              <Text style={styles.whyBody}>{copy.why}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <ChangeLocationModal
        visible={changing}
        value={draftZip}
        onChange={setDraftZip}
        onCancel={() => setChanging(false)}
        onSave={async () => {
          const next = draftZip.trim();
          if (next.length !== 5) return;
          await setStoredZip(next);
          setChanging(false);
          load(next);
        }}
      />
    </SafeAreaView>
  );
}

function ChangeLocationModal({
  visible,
  value,
  onChange,
  onCancel,
  onSave,
}: {
  visible: boolean;
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const valid = value.trim().length === 5;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Pressable style={styles.modalScrim} onPress={onCancel}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Change location</Text>
          <Text style={styles.modalBody}>
            Enter a ZIP code to see the officials who represent that area.
          </Text>
          <TextInput
            value={value}
            onChangeText={(v) => onChange(v.replace(/[^0-9]/g, "").slice(0, 5))}
            keyboardType="number-pad"
            maxLength={5}
            autoFocus
            placeholder="ZIP code"
            placeholderTextColor="#8A929A"
            accessibilityLabel="ZIP code"
            style={styles.modalInput}
          />
          <View style={styles.modalActions}>
            <Pressable onPress={onCancel} accessibilityRole="button" style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              disabled={!valid}
              accessibilityRole="button"
              accessibilityState={{ disabled: !valid }}
              style={[styles.modalSave, !valid && styles.modalSaveDisabled]}
            >
              <Text style={styles.modalSaveText}>Save</Text>
            </Pressable>
          </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ABBR_TO_NAME: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  PR: "Puerto Rico",
};

function fullStateName(abbr: string): string | null {
  return ABBR_TO_NAME[abbr] ?? null;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.light.canvas },
  // Clears the fixed tab bar so the last card is never stranded behind it.
  scroll: { paddingBottom: 100 },

  header: { paddingTop: 20 },
  // Brand mark inline with the title, so it costs no vertical space — the
  // screen title keeps doing the wayfinding and the emblem just makes sure
  // Politick is present if the screen is ever screenshotted.
  titleRow: { flexDirection: "row", alignItems: "center", columnGap: 9 },
  emblem: { width: 24, height: 24 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: "700", letterSpacing: -0.5, color: "#101418" },
  locationRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  location: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 21, fontWeight: "400", color: "#5D6670" },
  changeButton: {
    height: 38,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(22,125,121,0.45)",
  },
  changeText: { fontSize: 14, lineHeight: 18, fontWeight: "600", color: "#167D79" },

  tabs: {
    marginTop: 20,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#DDE1E5",
    backgroundColor: "#FFFFFF",
  },
  tab: { flex: 1, height: 52, alignItems: "center", justifyContent: "center" },
  tabLabel: { fontSize: 16, lineHeight: 22, fontWeight: "600", color: "#101418" },
  tabLabelActive: { color: "#167D79" },
  tabUnderline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -1,
    height: 3,
    borderRadius: 999,
    backgroundColor: "#167D79",
  },

  sectionTitle: { marginTop: 22, fontSize: 18, lineHeight: 24, fontWeight: "700", color: "#101418" },
  sectionDescription: { marginTop: 6, fontSize: 14, lineHeight: 21, fontWeight: "400", color: "#5D6670" },

  group: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    shadowColor: "#101418",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  row: {
    minHeight: 104,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 14,
  },
  portrait: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#EEE9DE" },
  portraitEmpty: { alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, minWidth: 0 },
  rowLevel: { fontSize: 12, lineHeight: 16, fontWeight: "700", color: "#0D5F5B" },
  rowName: { marginTop: 1, fontSize: 18, lineHeight: 23, fontWeight: "700", letterSpacing: -0.2, color: "#101418" },
  rowOffice: { marginTop: 1, fontSize: 14, lineHeight: 20, fontWeight: "400", color: "#5D6670" },
  rowDivider: {
    position: "absolute",
    left: 86,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: "#DDE1E5",
  },

  controlCard: {
    marginTop: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  controlHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  controlTitle: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 22, fontWeight: "700", color: "#101418" },
  chevronCollapsed: { transform: [{ rotate: "-90deg" }] },
  chips: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#EEF4F2" },
  chipText: { fontSize: 13, lineHeight: 18, fontWeight: "600", color: "#0D5F5B" },

  whyCard: {
    marginTop: 18,
    padding: 18,
    flexDirection: "row",
    columnGap: 14,
    borderWidth: 1,
    borderColor: "rgba(22,125,121,0.18)",
    borderRadius: 16,
    backgroundColor: "#F3FAF8",
  },
  whyText: { flex: 1, minWidth: 0 },
  whyTitle: { fontSize: 18, lineHeight: 24, fontWeight: "700", color: "#0D5F5B" },
  whyBody: { marginTop: 4, fontSize: 14, lineHeight: 22, fontWeight: "400", color: "#42505A" },

  emptyCard: {
    marginTop: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  emptyText: { fontSize: 14, lineHeight: 21, color: "#5D6670" },

  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(16,20,24,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: { width: "100%", maxWidth: 340, padding: 20, borderRadius: 18, backgroundColor: "#FFFFFF" },
  modalTitle: { fontSize: 18, lineHeight: 24, fontWeight: "700", color: "#101418" },
  modalBody: { marginTop: 6, fontSize: 14, lineHeight: 20, color: "#5D6670" },
  modalInput: {
    marginTop: 14,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    backgroundColor: "#F7F6F2",
    fontSize: 16,
    color: "#101418",
  },
  modalActions: { marginTop: 16, flexDirection: "row", justifyContent: "flex-end", columnGap: 8 },
  modalCancel: { height: 44, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  modalCancelText: { fontSize: 14, fontWeight: "600", color: "#5D6670" },
  modalSave: {
    height: 44,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#0D5F5B",
  },
  modalSaveDisabled: { opacity: 0.4 },
  modalSaveText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
});
