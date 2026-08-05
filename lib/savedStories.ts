import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "politick.savedStoryIds";

export async function getSavedIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function toggleSavedId(id: string): Promise<string[]> {
  const current = await getSavedIds();
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
