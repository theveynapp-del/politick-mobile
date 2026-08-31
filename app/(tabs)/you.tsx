import { useEffect, useState, useCallback } from "react";
import {
  View,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Modal,
  TextInput,
  useWindowDimensions,
} from "react-native";
import Constants from "expo-constants";
import { Text } from "@/components/Text";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Settings,
  ChevronRight,
  RefreshCw,
  Pencil,
  UserRound,
  MapPin,
  Bell,
  Clock,
  Sun,
  Bookmark,
  History,
  Download,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { getZipLocation } from "@/lib/queries";
import { getSavedIds } from "@/lib/savedStories";
import {
  getStoredZip,
  setStoredZip,
  getStoredName,
  setStoredName,
  getNotificationsEnabled,
  setNotificationsEnabled,
} from "@/lib/onboarding";

const DEFAULT_ZIP = "20814";

/**
 * Profile. The dark header carries identity, the white sheet carries settings.
 *
 * Rows are only interactive where something real is behind them. Daily
 * briefing time, display mode and the two history rows are drawn but marked
 * "Soon" — there is no scheduler, no theme switching and no reading or
 * download history in the app yet, and a chevron that goes nowhere is worse
 * than an honest label.
 */
export default function YouScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const gutter = width <= 380 ? 16 : 20;

  const [name, setName] = useState<string | null>(null);
  const [zip, setZip] = useState(DEFAULT_ZIP);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [notif, setNotif] = useState(true);
  const [savedCount, setSavedCount] = useState(0);

  const [editingProfile, setEditingProfile] = useState(false);
  const [editingZip, setEditingZip] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftZip, setDraftZip] = useState("");

  const loadZipPlace = useCallback(async (z: string) => {
    const place = await getZipLocation(supabase, z);
    setPlaceLabel(place ? `${place.city}, ${place.stateAbbr}` : null);
  }, []);

  useEffect(() => {
    // Normalised to null: clearing a field stores "", and ?? only guards null,
    // so an empty string rendered as a blank line where the prompt should be.
    const orNull = (v: string | null) => (v && v.trim() ? v : null);
    getStoredName().then((v) => setName(orNull(v)));
    getNotificationsEnabled().then(setNotif);
    getStoredZip().then((stored) => {
      const z = stored && stored.length === 5 ? stored : DEFAULT_ZIP;
      setZip(z);
      loadZipPlace(z);
    });
  }, [loadZipPlace]);

  // Saved count changes on other screens, so re-read whenever this one is shown.
  useFocusEffect(
    useCallback(() => {
      getSavedIds().then((ids) => setSavedCount(ids.length));
    }, [])
  );

  const openProfileEditor = () => {
    setDraftName(name ?? "");
    setEditingProfile(true);
  };

  // Real and useful under the name, where the email used to sit. Nothing in
  // the app consumes an email address, so collecting one implied an account
  // that doesn't exist.
  const heroSubline = name
    ? [placeLabel, zip].filter(Boolean).join(" · ")
    : "Personalizes your Today greeting";

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { paddingHorizontal: gutter, paddingTop: insets.top + 18 }]}>
          <Pressable
            onPress={openProfileEditor}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Edit your name"
            style={styles.gear}
          >
            <Settings size={22} color="#FFFFFF" strokeWidth={1.9} />
          </Pressable>

          <Pressable onPress={openProfileEditor} accessibilityRole="button" accessibilityLabel="Edit your profile">
            {/* The pencil is the point: without it the name block looks like a
                label, and nothing on the screen says it can be edited. */}
            <View style={styles.heroNameRow}>
              <Text style={[styles.heroName, !name && styles.heroNamePlaceholder]} numberOfLines={1}>
                {name ?? "Add your name"}
              </Text>
              <Pencil size={17} color="rgba(255,255,255,0.85)" strokeWidth={2} />
            </View>
            <Text style={styles.heroSub}>{heroSubline}</Text>
          </Pressable>
        </View>

        <View style={[styles.sheet, { paddingHorizontal: gutter }]}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Your settings
          </Text>
          <View style={styles.group}>
            <Row
              icon={UserRound}
              label="Your name"
              value={name ?? "Not set"}
              hint={name ? null : "Used to greet you on Today"}
              onPress={openProfileEditor}
            />
            <Divider />
            <Row
              icon={MapPin}
              label="Edit ZIP Code"
              value={zip}
              hint={placeLabel}
              onPress={() => {
                setDraftZip(zip);
                setEditingZip(true);
              }}
            />
            <Divider />
            <Row
              icon={RefreshCw}
              label="Redo setup"
              hint="Set your ZIP, topics and alerts again"
              onPress={() => router.push("/onboarding")}
            />
            <Divider />
            <Row
              icon={Bell}
              label="Notification Preferences"
              control={
                <Switch
                  value={notif}
                  onValueChange={(v) => {
                    setNotif(v);
                    setNotificationsEnabled(v);
                  }}
                  trackColor={{ true: "#0D5F5B", false: "#D3D7DB" }}
                  thumbColor="#FFFFFF"
                  accessibilityLabel="Notifications"
                />
              }
            />
            <Divider />
            <Row icon={Clock} label="Daily Briefing Time" soon />
            <Divider />
            <Row icon={Sun} label="Display" value="Light Mode" soon />
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 26 }]} accessibilityRole="header">
            Your activity
          </Text>
          <View style={styles.group}>
            <Row
              icon={Bookmark}
              label="Saved Stories"
              value={savedCount > 0 ? String(savedCount) : undefined}
              onPress={() => router.push("/saved")}
            />
            <Divider />
            <Row icon={History} label="Reading History" soon />
            <Divider />
            <Row icon={Download} label="Download History" soon />
          </View>

          {/* Footer, not header: the lockup is a dark-on-light asset and would
              disappear against the header panel, and the header belongs to the
              reader's identity rather than the app's. This is also where the
              version and, later, the About and legal links live. */}
          <View style={styles.brandFooter}>
            <Image
              source={require("@/assets/rotunda-logo-lockup.png")}
              style={styles.footerMark}
              resizeMode="contain"
              accessibilityLabel="Rotunda"
            />
            <Text style={styles.footerVersion}>
              Version {Constants.expoConfig?.version ?? "—"}
            </Text>
          </View>
        </View>
      </ScrollView>

      <EditProfileModal
        visible={editingProfile}
        name={draftName}
        onChangeName={setDraftName}
        onCancel={() => setEditingProfile(false)}
        onSave={async () => {
          const n = draftName.trim();
          await setStoredName(n);
          setName(n || null);
          setEditingProfile(false);
        }}
      />

      <EditZipModal
        visible={editingZip}
        value={draftZip}
        onChange={setDraftZip}
        onCancel={() => setEditingZip(false)}
        onSave={async () => {
          const next = draftZip.trim();
          if (next.length !== 5) return;
          await setStoredZip(next);
          setZip(next);
          setEditingZip(false);
          loadZipPlace(next);
        }}
      />
    </SafeAreaView>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function Row({
  icon: Icon,
  label,
  value,
  hint,
  control,
  soon,
  onPress,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  value?: string;
  hint?: string | null;
  control?: React.ReactNode;
  soon?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <>
      <Icon size={20} color={soon ? "#9BA3AA" : "#41484F"} strokeWidth={1.9} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, soon && styles.rowLabelSoon]} numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text style={styles.rowHint} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>

      {value ? <Text style={[styles.rowValue, soon && styles.rowLabelSoon]}>{value}</Text> : null}
      {soon ? (
        <View style={styles.soonPill}>
          <Text style={styles.soonText}>Soon</Text>
        </View>
      ) : control ? (
        control
      ) : onPress ? (
        <ChevronRight size={20} color="#5D6670" strokeWidth={1.9} />
      ) : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{body}</View>;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.row}>
      {body}
    </Pressable>
  );
}

function EditProfileModal({
  visible,
  name,
  onChangeName,
  onCancel,
  onSave,
}: {
  visible: boolean;
  name: string;
  onChangeName: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.scrimFill}
      >
        <Pressable style={styles.scrim} onPress={onCancel}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Your name</Text>
            <Text style={styles.modalBody}>
              Used to greet you on Today. Stored on this device only — Rotunda has no account
              to sign in to.
            </Text>

            <TextInput
              value={name}
              onChangeText={onChangeName}
              placeholder="First name"
              placeholderTextColor="#8A929A"
              autoCapitalize="words"
              autoFocus
              accessibilityLabel="Name"
              style={[styles.input, { marginTop: 14 }]}
            />

            <View style={styles.modalActions}>
              <Pressable onPress={onCancel} accessibilityRole="button" style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={onSave} accessibilityRole="button" style={styles.modalSave}>
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function EditZipModal({
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
        style={styles.scrimFill}
      >
        <Pressable style={styles.scrim} onPress={onCancel}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Edit ZIP code</Text>
          <Text style={styles.modalBody}>
            Your ZIP decides which stories and representatives you see.
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
            style={[styles.input, { marginTop: 14 }]}
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

const styles = StyleSheet.create({
  // Canvas, not the hero colour: the hero paints its own dark and pays for
  // the status-bar inset itself, so nothing dark is left behind once it
  // scrolls away.
  safe: { flex: 1, backgroundColor: "#F7F6F2" },
  scroll: { paddingBottom: 100, backgroundColor: "#F7F6F2" },

  // A darkened Deep Teal, so the panel reads as brand rather than plain black.
  hero: { paddingBottom: 34, backgroundColor: "#12302E" },
  gear: { alignSelf: "flex-end", width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" },
  heroNameRow: { flexDirection: "row", alignItems: "center", columnGap: 9 },
  heroName: { flexShrink: 1, fontSize: 26, lineHeight: 32, fontWeight: "700", letterSpacing: -0.4, color: "#FFFFFF" },
  heroNamePlaceholder: { color: "rgba(255,255,255,0.75)" },
  heroSub: { marginTop: 4, fontSize: 14, lineHeight: 20, fontWeight: "400", color: "rgba(255,255,255,0.7)" },

  // Pulled up over the header so the sheet reads as sitting on top of it.
  sheet: {
    marginTop: -20,
    paddingTop: 22,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#F7F6F2",
  },
  sectionTitle: { fontSize: 17, lineHeight: 23, fontWeight: "700", letterSpacing: -0.2, color: "#101418" },

  group: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  row: { minHeight: 56, paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", columnGap: 12 },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 15, lineHeight: 20, fontWeight: "500", color: "#101418" },
  rowLabelSoon: { color: "#9BA3AA" },
  rowHint: { marginTop: 1, fontSize: 12.5, lineHeight: 17, color: "#5D6670" },
  rowValue: { fontSize: 14.5, lineHeight: 20, fontWeight: "400", color: "#5D6670" },
  divider: { height: 1, marginLeft: 46, backgroundColor: "#E7E9EC" },

  brandFooter: { marginTop: 34, alignItems: "center" },
  // 87x29 is the asset's real 1000:333. Explicit on both axes, for the same
  // reason as the Today header's wordmark: brandFooter is a column with
  // alignItems center, so the child's width is auto rather than stretched, and
  // an aspectRatio with no definite width resolves against the image's
  // intrinsic 1000px instead of the height set here.
  footerMark: { width: 87, height: 29 },
  footerVersion: { marginTop: 8, fontSize: 12, lineHeight: 16, fontWeight: "500", color: "#8A929A" },

  soonPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: "#EEE9DE" },
  soonText: { fontSize: 11, lineHeight: 15, fontWeight: "700", color: "#8A7A55" },

  scrimFill: { flex: 1 },
  scrim: { flex: 1, backgroundColor: "rgba(16,20,24,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "100%", maxWidth: 340, padding: 20, borderRadius: 18, backgroundColor: "#FFFFFF" },
  modalTitle: { fontSize: 18, lineHeight: 24, fontWeight: "700", color: "#101418" },
  modalBody: { marginTop: 6, fontSize: 13.5, lineHeight: 19, color: "#5D6670" },
  input: {
    marginTop: 6,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    backgroundColor: "#F7F6F2",
    fontSize: 16,
    color: "#101418",
  },
  modalActions: { marginTop: 18, flexDirection: "row", justifyContent: "flex-end", columnGap: 8 },
  modalCancel: { height: 44, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  modalCancelText: { fontSize: 14, fontWeight: "600", color: "#5D6670" },
  modalSave: { height: 44, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#0D5F5B" },
  modalSaveDisabled: { opacity: 0.4 },
  modalSaveText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
});
