import { useState, useCallback, useRef } from "react";
import { View, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Switch, Alert, Image, Keyboard, useWindowDimensions } from "react-native";
import { Navigation, Lock } from "lucide-react-native";
import { Text } from "@/components/Text";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { color, radius } from "@/lib/tokens";
import { supabase } from "@/lib/supabase";
import { getRepresentativesByZip } from "@/lib/queries";
import { Representative, RepLevel } from "@/lib/types";
import { Button } from "@/components/Button";
import { stateForZip } from "@/lib/zipToState";
import {
  setOnboardingComplete,
  setStoredZip,
  setStoredTopics,
  setNotificationsEnabled,
} from "@/lib/onboarding";

// Five distinct steps, matching the approved reference board's
// "Onboarding 1 of 5" through "5 of 5" numbering exactly — interests and
// notifications are separate steps now, not merged into one screen.
type Step = "welcome" | "zip" | "confirm" | "interests" | "notifications";
const STEP_ORDER: Step[] = ["welcome", "zip", "confirm", "interests", "notifications"];

const TOPIC_OPTIONS = [
  "Local government",
  "Economy",
  "Education",
  "Healthcare",
  "World affairs",
  "Climate",
  "Technology",
  "Elections",
];

const CONFIRM_TABS: RepLevel[] = ["Federal", "State", "Local"];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [confirmTab, setConfirmTab] = useState<RepLevel>("Federal");
  // Spec calls for 90210 as the location screen's default value.
  const [zip, setZip] = useState("90210");
  const [zipError, setZipError] = useState(false);
  const [reps, setReps] = useState<Representative[]>([]);
  const [loadingReps, setLoadingReps] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [topics, setTopics] = useState<string[]>(["Local government", "World affairs"]);
  const [notifChoice, setNotifChoice] = useState<"daily" | "breaking">("daily");
  const [finishing, setFinishing] = useState(false);

  const stepIndex = STEP_ORDER.indexOf(step);
  const stepNumber = stepIndex + 1;

  // Mirrors the spec's `@media (max-height: 820px)` block — tightens the
  // location screen's vertical rhythm on shorter devices (e.g. 375x812).
  const { height: windowHeight } = useWindowDimensions();
  const compact = windowHeight <= 820;

  // The wrapping SafeAreaView already applies the device inset. This tops it
  // up to the spec's `max(20px, env(safe-area-inset-*))` floor, which matters
  // on surfaces with no inset at all (web) where the label and the Continue
  // button would otherwise sit flush against the edges.
  const insets = useSafeAreaInsets();
  const topFloor = Math.max(0, 20 - insets.top);

  const zipInputRef = useRef<TextInput>(null);
  // onBlur fires in the same render as the 5th-digit auto-dismiss, so reading
  // `zip` there sees the previous (4-digit) value and wrongly flags an error.
  // This ref always holds the committed value.
  const zipValueRef = useRef(zip);

  // Keyboard.dismiss() alone is unreliable on RN Web (it leaves the field
  // focused), so blur the input directly as well. On iOS this is what
  // actually drops the number-pad, which has no return key to close it.
  const dismissKeyboard = useCallback(() => {
    zipInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const findDistricts = useCallback(async () => {
    if (zip.length !== 5) return;
    setLoadingReps(true);
    setLookupFailed(false);
    const data = await getRepresentativesByZip(supabase, zip);
    setReps(data);
    setLoadingReps(false);
    if (data.length === 0) setLookupFailed(true);
    setStep("confirm");
  }, [zip]);

  const toggleTopic = (topic: string) => {
    setTopics((prev) => (prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]));
  };

  const finish = async () => {
    setFinishing(true);
    await setStoredZip(zip);
    await setStoredTopics(topics);
    await setNotificationsEnabled(notifChoice === "daily");
    await setOnboardingComplete(true);
    router.replace("/(tabs)");
  };

  const skipOnboarding = () => {
    Alert.alert(
      "Preview Today",
      "You can finish setup any time from Profile \u2192 Redo location & topics setup. Continuing with a default ZIP for now.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: async () => {
            await setStoredZip("20814");
            await setOnboardingComplete(true);
            router.replace("/(tabs)");
          },
        },
      ]
    );
  };

  const goBack = () => {
    if (step === "zip") setStep("welcome");
    if (step === "confirm") setStep("zip");
    if (step === "interests") setStep("confirm");
    if (step === "notifications") setStep("interests");
  };

  const confirmGroups = CONFIRM_TABS.map((level) => ({
    level,
    reps: reps.filter((r) => r.level === level || (level === "Local" && r.level === "County")),
  }));

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* The location screen renders its own progress label inside its
          content column (28px gutter, no back button) per its spec, so it
          opts out of the shared step header. */}
      {step !== "welcome" && step !== "zip" && (
        <View style={styles.stepHeader}>
          <Pressable onPress={goBack} hitSlop={8}>
            <Text style={styles.backArrow}>{"\u2190"}</Text>
          </Pressable>
          <Text style={styles.stepHeaderLabel}>
            Onboarding {stepNumber} of {STEP_ORDER.length}
          </Text>
        </View>
      )}

      {step === "welcome" && (
        <View style={styles.welcomeWrap}>
          <Text style={styles.onboardingLabel}>Onboarding 1 of {STEP_ORDER.length}</Text>
          <Text style={styles.h1}>Welcome to</Text>
          {/* Approved horizontal logo lockup, used as a single image asset so
              emblem geometry, gold dots, and wordmark typography stay locked. */}
          <Image
            source={require("@/assets/politick-logo-lockup.png")}
            style={styles.welcomeLogo}
            resizeMode="contain"
            accessibilityLabel="Politick"
          />
          <Text style={styles.bodyMuted}>{"Understand what’s happening.\nKnow what it means for you."}</Text>
          <View style={styles.illustrationWrap}>
            <Image
              source={require("@/assets/onboarding-welcome.jpg")}
              style={styles.welcomeIllustration}
              resizeMode="cover"
              accessibilityLabel="People walking on a civic plaza in front of a capitol building"
            />
          </View>
          <View style={{ flex: 1 }} />
          <Button variant="Primary" onPress={() => setStep("zip")}>
            Get Started
          </Button>
          <Pressable onPress={skipOnboarding} style={styles.textBtn}>
            <Text style={styles.textBtnLabel}>I already have an account</Text>
          </Pressable>
        </View>
      )}

      {step === "zip" && (
        // Deliberately a View, not a Pressable. Wrapping this screen in a
        // Pressable to get tap-outside-to-dismiss makes the wrapper swallow
        // taps aimed at the ZIP field and blur it, so the field can't be
        // focused at all. Dismissal is handled on the 5th digit instead.
        <View style={[styles.locationScreen, { paddingTop: topFloor }]}>
          <View style={styles.locationContent}>
            <Text style={[styles.progressLabel, compact && styles.progressLabelCompact]}>
              Onboarding {stepNumber} of {STEP_ORDER.length}
            </Text>

            <Text style={[styles.locationHeadline, compact && styles.locationHeadlineCompact]}>
              Where do you live?
            </Text>

            {/* Line breaks are explicit so the copy wraps into the three
                lines the reference shows, at any of the target widths. */}
            <Text style={[styles.locationDescription, compact && styles.locationDescriptionCompact]}>
              {"We’ll show you the people who\nrepresent you and what matters\nin your area."}
            </Text>

            <View style={[styles.zipFieldGroup, compact && styles.zipFieldGroupCompact]}>
              <Text style={styles.zipLabel} nativeID="zipLabel">
                ZIP Code
              </Text>

              <View style={[styles.zipField, zipError && styles.zipFieldError]}>
                <TextInput
                  ref={zipInputRef}
                  style={styles.zipFieldInput}
                  value={zip}
                  onChangeText={(v) => {
                    const digits = v.replace(/[^0-9]/g, "").slice(0, 5);
                    zipValueRef.current = digits;
                    setZip(digits);
                    if (zipError) setZipError(false);
                    // A ZIP is always 5 digits, so the 5th one is an
                    // unambiguous "done" — drop the keyboard so Continue
                    // is reachable (iOS number-pad has no return key).
                    if (digits.length === 5) dismissKeyboard();
                  }}
                  onBlur={() => {
                    const v = zipValueRef.current;
                    setZipError(v.length > 0 && v.length !== 5);
                  }}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={5}
                  returnKeyType="done"
                  onSubmitEditing={dismissKeyboard}
                  accessibilityLabel="ZIP Code"
                  accessibilityLabelledBy="zipLabel"
                />

                <Pressable
                  style={styles.locationButton}
                  accessibilityRole="button"
                  accessibilityLabel="Use my current location"
                  onPress={dismissKeyboard}
                >
                  <Navigation size={23} color="#101418" strokeWidth={1.85} fill="none" />
                </Pressable>
              </View>

              {/* Fixed-height slot so showing the error doesn't shift the
                  layout or move the Continue button. */}
              <View style={styles.zipErrorSlot}>
                {zipError && <Text style={styles.zipErrorText}>Enter a valid 5-digit ZIP code.</Text>}
              </View>
            </View>

            <View style={[styles.privacyRow, compact && styles.privacyRowCompact]}>
              <View style={styles.privacyIconCol}>
                <Lock size={24} color="#252B30" strokeWidth={1.8} />
              </View>
              <Text style={styles.privacyText}>
                {"We only use this to personalize\nyour experience. Your data\nstays private."}
              </Text>
            </View>
          </View>

          <View style={styles.locationFooter}>
            {loadingReps ? (
              <ActivityIndicator color={color.brand.deepTeal} style={{ height: 58 }} />
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.continueButton,
                  zip.length !== 5 && styles.continueButtonDisabled,
                  pressed && zip.length === 5 && styles.continueButtonPressed,
                ]}
                disabled={zip.length !== 5}
                accessibilityRole="button"
                accessibilityState={{ disabled: zip.length !== 5 }}
                onPress={() => {
                  dismissKeyboard();
                  findDistricts();
                }}
              >
                <Text
                  style={[
                    styles.continueButtonText,
                    zip.length !== 5 && styles.continueButtonTextDisabled,
                  ]}
                >
                  Continue
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {step === "confirm" && (
        <View style={styles.page}>
          <Text style={styles.h1}>You&rsquo;re in {stateForZip(zip) ?? "your area"}</Text>
          <Text style={styles.bodyMuted}>
            {lookupFailed
              ? "We don't have representative data for this ZIP yet, but you can still continue — we'll keep looking."
              : "Here are your top officials."}
          </Text>

          {!lookupFailed && (
            <>
              <View style={styles.tabRow}>
                {CONFIRM_TABS.map((t) => (
                  <Pressable key={t} onPress={() => setConfirmTab(t)} style={[styles.tabBtn, confirmTab === t && styles.tabBtnActive]}>
                    <Text style={[styles.tabBtnText, confirmTab === t && styles.tabBtnTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </View>

              <ScrollView style={{ marginBottom: 8 }}>
                {(confirmGroups.find((g) => g.level === confirmTab)?.reps ?? []).length === 0 ? (
                  <Text style={styles.noRepsText}>No {confirmTab.toLowerCase()} representatives found for this ZIP yet.</Text>
                ) : (
                  confirmGroups
                    .find((g) => g.level === confirmTab)!
                    .reps.map((rep) => (
                      <View key={rep.id} style={styles.districtRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.districtName}>{rep.name}</Text>
                          <Text style={styles.districtSmall}>{rep.role}</Text>
                        </View>
                      </View>
                    ))
                )}
              </ScrollView>
            </>
          )}

          <View style={{ flex: 1 }} />
          <Pressable onPress={() => setStep("zip")} style={styles.secondaryLikeBtn}>
            <Text style={styles.secondaryLikeBtnText}>This looks wrong</Text>
          </Pressable>
          <Button variant="Primary" onPress={() => setStep("interests")}>
            Looks right
          </Button>
        </View>
      )}

      {step === "interests" && (
        <View style={styles.page}>
          <Text style={styles.eyebrow}>CHOOSE YOUR SIGNAL</Text>
          <Text style={styles.h1}>What should Politick prioritize?</Text>
          <Text style={styles.bodyMuted}>
            Select a few topics. You&rsquo;ll still receive a balanced daily briefing.
          </Text>
          <View style={styles.chipsWrap}>
            {TOPIC_OPTIONS.map((topic) => {
              const selected = topics.includes(topic);
              return (
                <Pressable
                  key={topic}
                  onPress={() => toggleTopic(topic)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{topic}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flex: 1 }} />
          <Button variant="Primary" onPress={() => setStep("notifications")}>
            Continue
          </Button>
        </View>
      )}

      {step === "notifications" && (
        <View style={styles.page}>
          <Text style={styles.eyebrow}>STAY IN THE KNOW</Text>
          <Text style={styles.h1}>Get your daily briefing and breaking updates.</Text>
          <View style={{ gap: 10, marginTop: 22 }}>
            <Pressable
              onPress={() => setNotifChoice("daily")}
              style={[styles.notifCard, notifChoice === "daily" && styles.notifCardActive]}
            >
              <View style={[styles.radioOuter, notifChoice === "daily" && styles.radioOuterActive]}>
                {notifChoice === "daily" && <View style={styles.radioInner} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>Daily Briefing</Text>
                <Text style={styles.notifDesc}>A 5-minute summary every morning.</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => setNotifChoice("breaking")}
              style={[styles.notifCard, notifChoice === "breaking" && styles.notifCardActive]}
            >
              <View style={[styles.radioOuter, notifChoice === "breaking" && styles.radioOuterActive]}>
                {notifChoice === "breaking" && <View style={styles.radioInner} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>Breaking Updates</Text>
                <Text style={styles.notifDesc}>Only for material changes to your saved stories or reps — never generic "big news" alerts.</Text>
              </View>
            </Pressable>
          </View>
          <View style={{ flex: 1 }} />
          {finishing ? (
            <ActivityIndicator color={color.brand.deepTeal} />
          ) : (
            <Button variant="Primary" onPress={finish}>
              Let&rsquo;s Go
            </Button>
          )}
          <Pressable onPress={finish} style={styles.textBtn}>
            <Text style={styles.textBtnLabel}>Set this later</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.light.canvas },
  // Screens 2–5 reuse screen 1's plain "Onboarding X of 5" label (no progress
  // bar) so the step indicator reads identically across the whole flow. The
  // back arrow stays for navigation, inline so vertical rhythm still matches.
  stepHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 24 },
  stepHeaderLabel: { fontSize: 11, color: color.light.muted, fontWeight: "600" },
  backArrow: { fontSize: 20, width: 22, color: color.light.ink },

  onboardingLabel: { fontSize: 11, color: color.light.muted, fontWeight: "600", marginBottom: 12 },
  welcomeWrap: { flex: 1, padding: 20, paddingTop: 24 },
  // 228 x 66 preserves the asset's exact 1000:287 aspect ratio, within the
  // spec's 220–235px lockup width.
  welcomeLogo: { width: 228, height: 66, marginTop: 2, marginBottom: 14 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, color: color.brand.deepTeal },
  h1: { fontSize: 30, fontWeight: "800", color: color.light.ink, marginTop: 8, marginBottom: 10, letterSpacing: -0.5 },
  bodyMuted: { fontSize: 15.5, color: color.light.muted, lineHeight: 22 },
  // Full-bleed within the page's 20px padding. The 4:3 ratio lives on the
  // wrapper (not the Image) — RN Web ignores aspectRatio on Image and falls
  // back to the asset's intrinsic 900px height, which letterboxes the art
  // and pushes the CTAs off-screen.
  illustrationWrap: { marginTop: 28, marginHorizontal: -20, aspectRatio: 4 / 3 },
  welcomeIllustration: { width: "100%", height: "100%" },
  textBtn: { paddingVertical: 14, alignItems: "center" },
  textBtnLabel: { color: color.brand.deepTeal, fontWeight: "700" },

  page: { flex: 1, padding: 20 },

  /* ---------- Onboarding 2: location (scoped to this screen only) ---------- */
  locationScreen: { flex: 1, backgroundColor: color.light.canvas },
  locationContent: { paddingHorizontal: 28 },

  progressLabel: { marginTop: 30, fontSize: 14, lineHeight: 20, fontWeight: "600", color: "#41484F", letterSpacing: -0.1 },
  progressLabelCompact: { marginTop: 22 },

  locationHeadline: { marginTop: 36, fontSize: 30, lineHeight: 36, fontWeight: "700", color: "#101418", letterSpacing: -0.55 },
  locationHeadlineCompact: { marginTop: 30 },

  locationDescription: { marginTop: 24, fontSize: 18, lineHeight: 28, fontWeight: "400", color: "#252B30", letterSpacing: -0.1 },
  locationDescriptionCompact: { marginTop: 20 },

  zipFieldGroup: { marginTop: 50 },
  zipFieldGroupCompact: { marginTop: 38 },
  zipLabel: { marginBottom: 10, fontSize: 15, lineHeight: 20, fontWeight: "600", color: "#252B30" },

  zipField: {
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#D8D2C7",
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.28)",
    overflow: "hidden",
  },
  zipFieldError: { borderColor: color.brand.actionCoral },
  zipFieldInput: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    paddingLeft: 18,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "500",
    color: "#101418",
  },
  // 52x52 visual, but hitSlop-free 44x44 minimum is already satisfied.
  locationButton: { width: 52, height: 52, marginRight: 8, alignItems: "center", justifyContent: "center" },

  // Reserved height keeps Continue from shifting when the error appears.
  zipErrorSlot: { minHeight: 22, justifyContent: "center" },
  zipErrorText: { marginTop: 4, fontSize: 13.5, lineHeight: 18, fontWeight: "500", color: color.brand.actionCoral },

  privacyRow: { marginTop: 28, flexDirection: "row", alignItems: "flex-start" },
  privacyRowCompact: { marginTop: 22 },
  privacyIconCol: { width: 28, marginRight: 14, alignItems: "flex-start" },
  privacyText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: "400", color: "#5D6670" },

  locationFooter: { marginTop: "auto", paddingHorizontal: 28, paddingBottom: 24 },
  continueButton: {
    height: 58,
    borderRadius: 12,
    backgroundColor: "#0D5F5B",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#101418",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 7,
    elevation: 2,
  },
  continueButtonPressed: { backgroundColor: "#094D4A", transform: [{ scale: 0.99 }] },
  continueButtonDisabled: { backgroundColor: "#A9B5B4", shadowOpacity: 0, elevation: 0 },
  continueButtonText: { fontSize: 17, lineHeight: 22, fontWeight: "600", color: "#FFFFFF" },
  continueButtonTextDisabled: { color: "rgba(255,255,255,0.85)" },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: color.light.ink, marginTop: 22, marginBottom: 8 },
  zipInput: { height: 54, borderRadius: radius.button, borderWidth: 1.5, borderColor: color.light.border, backgroundColor: "#fff", paddingHorizontal: 16, fontSize: 20, fontWeight: "600", color: color.light.ink },
  privacyNote: { flexDirection: "row", marginTop: 18 },
  privacyNoteText: { fontSize: 13, color: color.light.muted, lineHeight: 19, flex: 1 },

  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: color.light.border, marginTop: 20, marginBottom: 14 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive: { borderBottomColor: color.brand.signalGold },
  tabBtnText: { fontSize: 12.5, fontWeight: "600", color: color.light.muted },
  tabBtnTextActive: { color: color.brand.deepTeal, fontWeight: "700" },
  noRepsText: { fontSize: 13, color: color.light.muted, textAlign: "center", paddingVertical: 24 },

  districtRow: { flexDirection: "row", gap: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: color.light.border, borderRadius: 14, padding: 14, marginBottom: 8, alignItems: "center" },
  districtName: { fontSize: 14.5, fontWeight: "700", color: color.light.ink },
  districtSmall: { fontSize: 12, color: color.light.muted, marginTop: 1 },

  secondaryLikeBtn: { alignItems: "center", paddingVertical: 14, marginBottom: 4 },
  secondaryLikeBtnText: { fontSize: 14, fontWeight: "700", color: color.light.ink },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 20 },
  chip: { borderWidth: 1, borderColor: color.light.border, backgroundColor: "#fff", paddingVertical: 10, paddingHorizontal: 13, borderRadius: 999 },
  chipSelected: { backgroundColor: color.brand.softTeal, borderColor: color.brand.civicTeal },
  chipText: { fontSize: 13, color: color.light.ink },
  chipTextSelected: { color: color.brand.deepTeal, fontWeight: "700" },

  notifCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#fff", borderWidth: 1.5, borderColor: color.light.border, borderRadius: 14, padding: 16 },
  notifCardActive: { borderColor: color.brand.civicTeal },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: color.light.border, alignItems: "center", justifyContent: "center", marginTop: 1 },
  radioOuterActive: { borderColor: color.brand.civicTeal },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.brand.civicTeal },
  notifTitle: { fontSize: 14, fontWeight: "700", color: color.light.ink, marginBottom: 3 },
  notifDesc: { fontSize: 12.5, color: color.light.muted, lineHeight: 17 },
});
