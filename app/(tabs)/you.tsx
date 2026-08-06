import { useEffect, useState } from "react";
import { View, TextInput, Pressable, StyleSheet, Switch, ScrollView } from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Settings, ChevronRight } from "lucide-react-native";
import { color, radius } from "@/lib/tokens";
import {
  getStoredZip,
  setStoredZip,
  getStoredTopics,
  getNotificationsEnabled,
  setNotificationsEnabled,
  setOnboardingComplete,
} from "@/lib/onboarding";

/**
 * "You" / Profile — matches the reference board's Deep Teal header +
 * grouped white settings cards, while staying real (not decorative):
 * ZIP and notifications actually persist and feed Today/My Reps.
 */
export default function YouScreen() {
  const router = useRouter();
  const [zip, setZip] = useState("");
  const [editingZip, setEditingZip] = useState(false);
  const [topics, setTopics] = useState<string[]>([]);
  const [notifEnabled, setNotifEnabled] = useState(true);

  useEffect(() => {
    Promise.all([getStoredZip(), getStoredTopics(), getNotificationsEnabled()]).then(
      ([storedZip, storedTopics, storedNotif]) => {
        setZip(storedZip ?? "20814");
        setTopics(storedTopics);
        setNotifEnabled(storedNotif);
      }
    );
  }, []);

  const saveZip = async () => {
    if (zip.length !== 5) return;
    await setStoredZip(zip);
    setEditingZip(false);
  };

  const toggleNotif = async (value: boolean) => {
    setNotifEnabled(value);
    await setNotificationsEnabled(value);
  };

  const redoOnboarding = async () => {
    await setOnboardingComplete(false);
    router.replace("/onboarding");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.heroHeader}>
        <View>
          <Text style={styles.heroName}>Your account</Text>
          <Text style={styles.heroEmail}>Not signed in yet</Text>
        </View>
        <Settings size={20} color="#fff" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.sectionLabel}>Your settings</Text>
        <View style={styles.group}>
          {editingZip ? (
            <View style={styles.editZipRow}>
              <TextInput
                style={styles.zipInput}
                value={zip}
                onChangeText={setZip}
                keyboardType="number-pad"
                maxLength={5}
                autoFocus
              />
              <Pressable onPress={saveZip} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.row} onPress={() => setEditingZip(true)}>
              <Text style={styles.rowLabel}>Edit ZIP Code</Text>
              <Text style={styles.rowValue}>{zip}</Text>
            </Pressable>
          )}
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Notification Preferences</Text>
            <Switch value={notifEnabled} onValueChange={toggleNotif} trackColor={{ true: color.brand.civicTeal, false: color.light.border }} />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Daily Briefing Time</Text>
            <Text style={styles.rowValue}>7:30 AM</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Display</Text>
            <Text style={styles.rowValue}>Light Mode</Text>
          </View>
        </View>

        {topics.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Your topics</Text>
            <View style={styles.chipsWrap}>
              {topics.map((t) => (
                <View key={t} style={styles.chip}>
                  <Text style={styles.chipText}>{t}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>Your activity</Text>
        <View style={styles.group}>
          {["Saved Stories", "Reading History", "Download History"].map((label, i, arr) => (
            <View key={label}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{label}</Text>
                <ChevronRight size={16} color={color.light.muted} />
              </View>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <Pressable onPress={redoOnboarding} style={styles.redoBtn}>
          <Text style={styles.redoBtnText}>Redo location &amp; topics setup</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.light.canvas },
  heroHeader: { backgroundColor: color.brand.deepTeal, padding: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroName: { fontSize: 19, fontWeight: "700", color: "#fff" },
  heroEmail: { fontSize: 11.5, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: color.light.muted, marginTop: 20, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 },
  group: { backgroundColor: color.light.surface, borderWidth: 1, borderColor: color.light.border, borderRadius: radius.card, paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  rowLabel: { fontSize: 14, fontWeight: "600", color: color.light.ink },
  rowValue: { fontSize: 13, color: color.light.muted },
  divider: { height: 1, backgroundColor: color.light.border },
  editZipRow: { flexDirection: "row", gap: 10, paddingVertical: 10, alignItems: "center" },
  zipInput: { flex: 1, height: 40, borderRadius: 8, borderWidth: 1, borderColor: color.light.border, paddingHorizontal: 10, fontSize: 14, color: color.light.ink },
  saveBtn: { paddingHorizontal: 14, height: 40, justifyContent: "center", backgroundColor: color.brand.deepTeal, borderRadius: 8 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 12.5 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: color.brand.softTeal, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12.5, fontWeight: "600", color: color.brand.deepTeal },
  redoBtn: { alignItems: "center", paddingVertical: 20 },
  redoBtnText: { color: color.brand.deepTeal, fontWeight: "700", fontSize: 13.5 },
});
