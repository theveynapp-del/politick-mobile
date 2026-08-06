import { useCallback, useState } from "react";
import { View, TextInput, Pressable, StyleSheet, Switch, ScrollView } from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import {
  Settings,
  ChevronRight,
  MapPin,
  Bell,
  Clock,
  Sun,
  Bookmark,
  History,
  Download,
} from "lucide-react-native";
import { color, radius } from "@/lib/tokens";
import {
  getStoredZip,
  setStoredZip,
  getStoredTopics,
  getStoredName,
  getStoredEmail,
  getNotificationsEnabled,
  setNotificationsEnabled,
  setOnboardingComplete,
} from "@/lib/onboarding";

/**
 * Profile / Settings — Deep Teal header with real (or honestly-empty) name
 * and email, grouped settings + activity cards below. Name/email are
 * user-entered via the gear icon's account screen (no real auth session
 * exists yet in this app), never a hardcoded placeholder person.
 */
export default function YouScreen() {
  const router = useRouter();
  const [zip, setZip] = useState("");
  const [editingZip, setEditingZip] = useState(false);
  const [topics, setTopics] = useState<string[]>([]);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([getStoredZip(), getStoredTopics(), getNotificationsEnabled(), getStoredName(), getStoredEmail()]).then(
        ([storedZip, storedTopics, storedNotif, storedName, storedEmail]) => {
          setZip(storedZip ?? "20814");
          setTopics(storedTopics);
          setNotifEnabled(storedNotif);
          setName(storedName);
          setEmail(storedEmail);
        }
      );
    }, [])
  );

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
        <View style={{ flex: 1 }}>
          <Text style={styles.heroName} numberOfLines={1}>
            {name || "Add your name"}
          </Text>
          <Text style={styles.heroEmail} numberOfLines={1}>
            {email || "Add your email"}
          </Text>
        </View>
        <Pressable onPress={() => router.push("/profile/account")} hitSlop={8}>
          <Settings size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Text style={styles.sectionLabel}>Your settings</Text>
          <View style={styles.group}>
            {editingZip ? (
              <View style={styles.editZipRow}>
                <MapPin size={18} color={color.light.ink} style={styles.rowIcon} />
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
                <MapPin size={18} color={color.light.ink} style={styles.rowIcon} />
                <Text style={styles.rowLabel}>Edit ZIP Code</Text>
                <Text style={styles.rowValue}>{zip}</Text>
                <ChevronRight size={16} color={color.light.muted} />
              </Pressable>
            )}
            <View style={styles.divider} />
            <View style={styles.row}>
              <Bell size={18} color={color.light.ink} style={styles.rowIcon} />
              <Text style={styles.rowLabel}>Notification Preferences</Text>
              <Switch value={notifEnabled} onValueChange={toggleNotif} trackColor={{ true: color.brand.civicTeal, false: color.light.border }} />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Clock size={18} color={color.light.ink} style={styles.rowIcon} />
              <Text style={styles.rowLabel}>Daily Briefing Time</Text>
              <Text style={styles.rowValue}>Not set</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Sun size={18} color={color.light.ink} style={styles.rowIcon} />
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
            <Pressable style={styles.row} onPress={() => router.push("/(tabs)/saved")}>
              <Bookmark size={18} color={color.light.ink} style={styles.rowIcon} />
              <Text style={styles.rowLabel}>Saved Stories</Text>
              <ChevronRight size={16} color={color.light.muted} />
            </Pressable>
            <View style={styles.divider} />
            <View style={styles.row}>
              <History size={18} color={color.light.muted} style={styles.rowIcon} />
              <Text style={[styles.rowLabel, { color: color.light.muted }]}>Reading History</Text>
              <Text style={styles.rowHint}>Not tracked yet</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Download size={18} color={color.light.muted} style={styles.rowIcon} />
              <Text style={[styles.rowLabel, { color: color.light.muted }]}>Download History</Text>
              <Text style={styles.rowHint}>Not tracked yet</Text>
            </View>
          </View>

          <Pressable onPress={redoOnboarding} style={styles.redoBtn}>
            <Text style={styles.redoBtnText}>Redo location &amp; topics setup</Text>
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.brand.deepTeal },
  heroHeader: {
    backgroundColor: color.brand.deepTeal,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroName: { fontSize: 19, fontWeight: "700", color: "#fff" },
  heroEmail: { fontSize: 11.5, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  sheet: {
    flex: 1,
    backgroundColor: color.light.canvas,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    marginTop: -18,
  },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: color.light.muted, marginTop: 20, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 },
  group: { backgroundColor: color.light.surface, borderWidth: 1, borderColor: color.light.border, borderRadius: radius.card, paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, minHeight: 56 },
  rowIcon: { width: 18 },
  rowLabel: { fontSize: 14, fontWeight: "600", color: color.light.ink, flex: 1 },
  rowValue: { fontSize: 13, color: color.light.muted, marginRight: 4 },
  rowHint: { fontSize: 11.5, color: color.light.muted },
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
