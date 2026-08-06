import { useState, useCallback, useRef } from "react";
import { View, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Switch, Alert, Image, Keyboard, useWindowDimensions } from "react-native";
import { Navigation, Lock, ArrowLeft, ChevronRight } from "lucide-react-native";
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
  "Healthcare",
  "Education",
  "Housing",
  "Immigration",
  "Trade",
  "World affairs",
  "Climate",
  "Technology",
  "Elections",
  "Taxes",
];

const CONFIRM_TABS: RepLevel[] = ["Local", "State", "Federal"];

/**
 * Back arrow + progress label, inline so it costs no vertical space. Shown on
 * every onboarding screen except the first, which has nothing to go back to.
 */
function StepHeaderRow({
  stepNumber,
  compact,
  onBack,
}: {
  stepNumber: number;
  compact: boolean;
  onBack: () => void;
}) {
  return (
    <View style={[styles.stepRow, compact && styles.stepRowCompact]}>
      <Pressable
        onPress={onBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={styles.stepBackBtn}
      >
        <ArrowLeft size={22} color="#101418" strokeWidth={2} />
      </Pressable>
      <Text style={styles.progressLabel}>
        Onboarding {stepNumber} of {STEP_ORDER.length}
      </Text>
    </View>
  );
}

/**
 * The reference mockup lists a fixed trio of officials, but this app resolves
 * real representatives per ZIP. These map the real `role`/`level` we store
 * onto the reference's two-line role/office treatment, without inventing
 * detail we don't hold — notably district numbers, which aren't stored.
 */
function roleLineFor(rep: Representative): string {
  if (/senator/i.test(rep.role)) return "Senator";
  if (/representative|delegate|assembly/i.test(rep.role)) return "Representative";
  return rep.role;
}

// Statewide elected executives — they hold office in the state government,
// not the legislature, so they must not be labelled as legislators.
const STATE_EXEC_ROLES = new Set([
  "Governor",
  "Lieutenant Governor",
  "Attorney General",
  "Secretary of State",
  "Comptroller",
  "Treasurer",
]);

function officeLineFor(rep: Representative, stateName: string | null): string {
  if (rep.level === "Federal") {
    return /senator/i.test(rep.role) ? "U.S. Senate" : "U.S. House";
  }
  if (rep.level === "State") {
    if (STATE_EXEC_ROLES.has(rep.role)) {
      return stateName ? `State of ${stateName}` : "Statewide office";
    }
    return stateName ? `${stateName} Legislature` : "State legislature";
  }
  // Local roles (Supervisor, Councilmember, Mayor…) already carry the office
  // name in `role`, so repeating it here would just duplicate the line. We
  // don't store the county/city, so stay general rather than invent one.
  return "Local government";
}

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [confirmTab, setConfirmTab] = useState<RepLevel>("Federal");
  // No default. The reference mockup shows 90210 filled in, but prefilling a
  // real ZIP means anyone who taps Continue without editing gets Beverly
  // Hills officials presented as their own.
  const [zip, setZip] = useState("");
  const [zipError, setZipError] = useState(false);
  // Some official portrait URLs from the data source are dead links (the
  // Maryland governor's is a 404). Without tracking load failures the row
  // renders an empty circle instead of falling back to initials.
  const [failedPhotos, setFailedPhotos] = useState<Record<string, boolean>>({});
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
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const compact = windowHeight <= 820;
  // Spec: at 375px wide, drop the signal screen's gutter from 24px to 20px.
  const narrow = windowWidth <= 375;

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

  const visibleReps = confirmGroups.find((g) => g.level === confirmTab)?.reps ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* The location and representatives screens render their own header
          inside their content column (28px gutter) to keep it aligned with
          their copy, so they opt out of the shared one. */}
      {step !== "welcome" && step !== "zip" && step !== "confirm" && step !== "interests" && (
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
            <StepHeaderRow stepNumber={stepNumber} compact={compact} onBack={goBack} />

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
        <View style={[styles.repsScreen, { paddingTop: topFloor }]}>
          {/* Scrollable so the footer stays reachable. Three federal reps fit
              without scrolling as the spec expects, but a Local tab can carry
              eight or more officials, which previously pushed "Looks Right"
              below the fold with no way to reach it. */}
          <ScrollView
            style={styles.repsScroll}
            contentContainerStyle={styles.repsContent}
            showsVerticalScrollIndicator={false}
          >
            <StepHeaderRow stepNumber={stepNumber} compact={compact} onBack={goBack} />

            <Text style={[styles.repsHeadline, compact && styles.repsHeadlineCompact]}>
              You&rsquo;re in {stateForZip(zip) ?? "your area"}
            </Text>

            <Text style={styles.repsDescription}>
              {lookupFailed
                ? "We don’t have representative data for this ZIP yet."
                : "Here are your top officials."}
            </Text>

            <View
              style={[styles.officeTabs, compact && styles.officeTabsCompact]}
              accessibilityRole="tablist"
            >
              {CONFIRM_TABS.map((t) => {
                const active = confirmTab === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setConfirmTab(t)}
                    style={styles.officeTab}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.officeTabText, active && styles.officeTabTextActive]}>{t}</Text>
                    {active && <View style={styles.officeTabUnderline} />}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.repGroup}>
              {visibleReps.length === 0 ? (
                <View style={styles.repEmptyRow}>
                  <Text style={styles.repEmptyText}>
                    No {confirmTab.toLowerCase()} officials found for this ZIP yet.
                  </Text>
                </View>
              ) : (
                visibleReps.map((rep, i) => (
                  <View key={rep.id} style={[styles.repRow, compact && styles.repRowCompact]}>
                    {i > 0 && <View style={styles.repDivider} />}
                    {rep.photoUrl && !failedPhotos[rep.id] ? (
                      <Image
                        source={{ uri: rep.photoUrl }}
                        style={styles.repAvatar}
                        accessibilityLabel={`Portrait of ${rep.name}`}
                        onError={() => setFailedPhotos((prev) => ({ ...prev, [rep.id]: true }))}
                      />
                    ) : (
                      <View style={[styles.repAvatar, styles.repAvatarFallback]}>
                        <Text style={styles.repAvatarInitials}>
                          {rep.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </Text>
                      </View>
                    )}

                    <View style={styles.repTextBlock}>
                      <Text style={styles.repRole}>{roleLineFor(rep)}</Text>
                      <Text style={styles.repName} numberOfLines={2}>
                        {rep.name}
                      </Text>
                      <Text style={styles.repOffice}>{officeLineFor(rep, stateForZip(zip))}</Text>
                    </View>

                    <ChevronRight size={21} color="#5D6670" strokeWidth={1.8} />
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          <View style={styles.repsFooter}>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
              accessibilityRole="button"
              onPress={() => setStep("interests")}
            >
              <Text style={styles.primaryButtonText}>Looks Right</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryAction}
              accessibilityRole="button"
              onPress={() => setStep("zip")}
            >
              <Text style={styles.secondaryActionText}>Edit ZIP Code</Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === "interests" && (
        <View style={[styles.signalScreen, { paddingTop: topFloor }]}>
          <View style={[styles.signalContent, narrow && styles.signalContentNarrow]}>
            <View style={styles.signalTopRow}>
              <Pressable
                onPress={goBack}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Back"
                style={styles.signalBackBtn}
              >
                <ArrowLeft size={24} color="#101418" strokeWidth={1.8} />
              </Pressable>
              <Text style={styles.signalProgress}>
                Onboarding {stepNumber} of {STEP_ORDER.length}
              </Text>
            </View>

            <Text style={styles.signalSectionLabel}>CHOOSE YOUR SIGNAL</Text>
            <Text style={styles.signalHeadline}>What should Politick prioritize?</Text>
            <Text style={styles.signalSupporting}>
              Select a few topics. You&rsquo;ll still receive a balanced daily briefing.
            </Text>

            <View style={styles.chipWrap}>
              {TOPIC_OPTIONS.map((topic) => {
                const selected = topics.includes(topic);
                return (
                  <Pressable
                    key={topic}
                    onPress={() => toggleTopic(topic)}
                    // Chips are 40px tall per spec; hitSlop brings the real
                    // touch target up to the 44px accessibility minimum.
                    hitSlop={{ top: 2, bottom: 2 }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={topic}
                    style={[styles.topicChip, selected && styles.topicChipSelected]}
                  >
                    <Text style={[styles.topicChipText, selected && styles.topicChipTextSelected]}>
                      {topic}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.signalFooter, narrow && styles.signalContentNarrow]}>
            <Pressable
              style={({ pressed }) => [styles.signalButton, pressed && styles.signalButtonPressed]}
              accessibilityRole="button"
              onPress={() => setStep("notifications")}
            >
              <Text style={styles.signalButtonText}>Continue</Text>
            </Pressable>
          </View>
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

  // Back arrow sits inline with the progress label so it costs no vertical
  // space and the spec's rhythm below it is preserved.
  stepRow: { marginTop: 30, flexDirection: "row", alignItems: "center", gap: 10 },
  stepRowCompact: { marginTop: 22 },
  stepBackBtn: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  progressLabel: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: "#41484F", letterSpacing: -0.1 },

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

  /* ---------- Onboarding 3: representatives (scoped to this screen) ---------- */
  repsScreen: { flex: 1, backgroundColor: color.light.canvas },
  repsScroll: { flex: 1 },
  repsContent: { paddingHorizontal: 28, paddingBottom: 24 },

  repsHeadline: { marginTop: 38, fontSize: 30, lineHeight: 36, fontWeight: "700", color: "#101418", letterSpacing: -0.55 },
  repsHeadlineCompact: { marginTop: 30 },
  repsDescription: { marginTop: 18, fontSize: 17, lineHeight: 24, fontWeight: "400", color: "#5D6670" },

  officeTabs: {
    marginTop: 30,
    height: 54,
    flexDirection: "row",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: "#E3E0D8",
  },
  officeTabsCompact: { marginTop: 24 },
  officeTab: { flex: 1, height: 54, alignItems: "center", justifyContent: "center" },
  officeTabText: { fontSize: 16, lineHeight: 22, fontWeight: "600", color: "#252B30" },
  officeTabTextActive: { color: "#101418" },
  officeTabUnderline: {
    position: "absolute",
    bottom: -1,
    height: 3,
    left: "18%",
    right: "18%",
    borderRadius: 999,
    backgroundColor: "#B84E3C",
  },

  repGroup: {
    marginTop: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#DDE1E5",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    shadowColor: "#101418",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  repRow: {
    position: "relative",
    minHeight: 100,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  repRowCompact: { minHeight: 94 },
  // Starts after the avatar so it never crosses the photo.
  repDivider: { position: "absolute", top: 0, left: 90, right: 0, height: 1, backgroundColor: "#DDE1E5" },
  repAvatar: { width: 64, height: 64, borderRadius: 999, backgroundColor: "#DCEFED" },
  repAvatarFallback: { alignItems: "center", justifyContent: "center" },
  repAvatarInitials: { fontSize: 20, fontWeight: "700", color: color.brand.deepTeal },
  repTextBlock: { flex: 1, minWidth: 0, alignItems: "flex-start" },
  repRole: { fontSize: 13, lineHeight: 18, fontWeight: "400", color: "#5D6670" },
  repName: { marginTop: 1, fontSize: 18, lineHeight: 24, fontWeight: "700", color: "#101418", letterSpacing: -0.2 },
  repOffice: { marginTop: 1, fontSize: 14, lineHeight: 20, fontWeight: "400", color: "#252B30" },
  repEmptyRow: { minHeight: 100, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  repEmptyText: { fontSize: 14, lineHeight: 20, color: "#5D6670", textAlign: "center" },

  // No marginTop:auto — the ScrollView above takes the free space, so the
  // footer stays pinned to the bottom at any list length.
  repsFooter: { paddingHorizontal: 28, paddingTop: 4, paddingBottom: 20 },
  primaryButton: {
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
  primaryButtonPressed: { backgroundColor: "#094D4A", transform: [{ scale: 0.99 }] },
  primaryButtonText: { fontSize: 17, lineHeight: 22, fontWeight: "600", color: "#FFFFFF" },
  secondaryAction: { minHeight: 44, marginTop: 14, alignItems: "center", justifyContent: "center" },
  secondaryActionText: { fontSize: 15, lineHeight: 20, fontWeight: "600", color: "#101418" },

  /* ---------- Onboarding 4: choose your signal (scoped to this screen) ---------- */
  // This screen's spec uses a 24px gutter and #101418 progress text, where
  // screens 2-3 use 28px and #41484F — hence its own header and styles.
  signalScreen: { flex: 1, backgroundColor: color.light.canvas },
  signalContent: { paddingHorizontal: 24 },
  signalContentNarrow: { paddingHorizontal: 20 },

  signalTopRow: { height: 44, flexDirection: "row", alignItems: "center", gap: 12 },
  signalBackBtn: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  signalProgress: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: "#101418" },

  signalSectionLabel: {
    marginTop: 20,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: "#0D5F5B",
  },
  signalHeadline: { marginTop: 8, fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: -0.5, color: "#101418" },
  signalSupporting: { marginTop: 12, fontSize: 16, lineHeight: 22, fontWeight: "400", color: "#5D6670" },

  chipWrap: { marginTop: 24, flexDirection: "row", flexWrap: "wrap", rowGap: 12, columnGap: 10 },
  topicChip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDE1E5",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  topicChipSelected: { backgroundColor: "#DCEFED", borderColor: "#0D5F5B" },
  topicChipText: { fontSize: 15, lineHeight: 20, fontWeight: "600", color: "#252B30" },
  topicChipTextSelected: { color: "#0D5F5B" },

  signalFooter: { marginTop: "auto", paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  signalButton: {
    height: 56,
    borderRadius: 12,
    backgroundColor: "#0D5F5B",
    alignItems: "center",
    justifyContent: "center",
  },
  signalButtonPressed: { backgroundColor: "#094D4A", transform: [{ scale: 0.99 }] },
  signalButtonText: { fontSize: 17, lineHeight: 22, fontWeight: "600", color: "#FFFFFF" },
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
