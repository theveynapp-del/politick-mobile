import AsyncStorage from "@react-native-async-storage/async-storage";

// The "politick." prefix is deliberate and must not be renamed with the brand.
// These are AsyncStorage keys on devices that already have the app installed:
// changing them orphans every existing reader's ZIP, name, topics and
// onboarding state, and the app would greet a returning user as brand new.
// A rename here is a data migration, not a find-and-replace.
const KEYS = {
  onboardingComplete: "politick.onboardingComplete",
  zip: "politick.zip",
  topics: "politick.topics",
  notificationsEnabled: "politick.notificationsEnabled",
  name: "politick.name",
  email: "politick.email",
} as const;

/**
 * Display name for the greeting. There's no sign-in yet and onboarding
 * doesn't ask for a name, so this is normally null — callers must fall back
 * to an unpersonalised greeting rather than inventing one.
 */
export async function getStoredName(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.name);
}

export async function setStoredName(name: string) {
  await AsyncStorage.setItem(KEYS.name, name);
}

export async function getStoredEmail(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.email);
}

export async function setStoredEmail(email: string) {
  await AsyncStorage.setItem(KEYS.email, email);
}

export async function getOnboardingComplete(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.onboardingComplete)) === "true";
}

export async function setOnboardingComplete(value: boolean) {
  await AsyncStorage.setItem(KEYS.onboardingComplete, value ? "true" : "false");
}

export async function getStoredZip(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.zip);
}

/**
 * The ZIP used before the reader has given one. Every screen had its own copy
 * of this literal, and the representative detail screen skipped the lookup
 * altogether and passed the literal straight to the query — so it showed
 * Bethesda's officials to everyone, everywhere.
 */
export const DEFAULT_ZIP = "20814";

/** The reader's ZIP, or the default. Guards the stored value's shape. */
export async function getZipOrDefault(): Promise<string> {
  const stored = await getStoredZip();
  return stored && stored.length === 5 ? stored : DEFAULT_ZIP;
}

export async function setStoredZip(zip: string) {
  await AsyncStorage.setItem(KEYS.zip, zip);
}

export async function getStoredTopics(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEYS.topics);
  return raw ? JSON.parse(raw) : [];
}

export async function setStoredTopics(topics: string[]) {
  await AsyncStorage.setItem(KEYS.topics, JSON.stringify(topics));
}

export async function getNotificationsEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEYS.notificationsEnabled);
  return raw === null ? true : raw === "true"; // default on, matches the prototype
}

export async function setNotificationsEnabled(value: boolean) {
  await AsyncStorage.setItem(KEYS.notificationsEnabled, value ? "true" : "false");
}
