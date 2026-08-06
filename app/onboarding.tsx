import { useState, useCallback } from "react";
import { View, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Switch, Alert, Image } from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
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
  const [zip, setZip] = useState("");
  const [reps, setReps] = useState<Representative[]>([]);
  const [loadingReps, setLoadingReps] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [topics, setTopics] = useState<string[]>(["Local government", "World affairs"]);
  const [notifChoice, setNotifChoice] = useState<"daily" | "breaking">("daily");
  const [finishing, setFinishing] = useState(false);

  const stepIndex = STEP_ORDER.indexOf(step);
  const stepNumber = stepIndex + 1;
  const stepProgressPct = (stepNumber / STEP_ORDER.length) * 100;

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
      {step !== "welcome" && (
        <View style={styles.appbar}>
          <Pressable onPress={goBack} hitSlop={8}>
            <Text style={styles.backArrow}>{"\u2190"}</Text>
          </Pressable>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${stepProgressPct}%` }]} />
          </View>
          <Text style={styles.stepMicro}>{stepNumber} of {STEP_ORDER.length}</Text>
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
        <View style={styles.page}>
          <Text style={styles.h1}>Where do you live?</Text>
          <Text style={styles.bodyMuted}>
            We&rsquo;ll show you the people who represent you and what matters in your area.
          </Text>
          <Text style={styles.fieldLabel}>ZIP Code</Text>
          <TextInput
            style={styles.zipInput}
            value={zip}
            onChangeText={setZip}
            keyboardType="number-pad"
            maxLength={5}
            placeholder="20814"
            placeholderTextColor={color.light.muted}
          />
          <View style={styles.privacyNote}>
            <Text style={styles.privacyNoteText}>
              🔒 We only use this to personalize your experience. Your data stays private.
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          {loadingReps ? (
            <ActivityIndicator color={color.brand.deepTeal} />
          ) : (
            <Button variant="Primary" disabled={zip.length !== 5} onPress={findDistricts}>
              Continue
            </Button>
          )}
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
  appbar: { flexDirection: "row", alignItems: "center", gap: 14, height: 56, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: color.light.border },
  backArrow: { fontSize: 20, width: 28 },
  progressTrack: { flex: 1, height: 4, backgroundColor: color.light.border, borderRadius: 99, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: color.brand.civicTeal },
  stepMicro: { fontSize: 11, color: color.light.muted },

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
