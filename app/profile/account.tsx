import { useEffect, useState } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { color, radius } from "@/lib/tokens";
import { getStoredName, setStoredName, getStoredEmail, setStoredEmail } from "@/lib/onboarding";

/**
 * Account details — the app has no real sign-in yet, so this screen is
 * the honest substitute: the user types their own name/email here and it's
 * what the Profile header displays, instead of a fabricated placeholder.
 */
export default function AccountScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    Promise.all([getStoredName(), getStoredEmail()]).then(([storedName, storedEmail]) => {
      setName(storedName ?? "");
      setEmail(storedEmail ?? "");
    });
  }, []);

  const save = async () => {
    await Promise.all([setStoredName(name.trim()), setStoredEmail(email.trim())]);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.appbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={24} color={color.light.ink} />
        </Pressable>
        <Text style={styles.appbarTitle}>Account</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={{ padding: 20 }}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={color.light.muted}
          autoCapitalize="words"
        />
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={color.light.muted}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Pressable style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>Save</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.light.canvas },
  appbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 56, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: color.light.border, backgroundColor: color.light.surface },
  appbarTitle: { fontSize: 14, fontWeight: "700", color: color.light.ink },
  label: { fontSize: 11.5, fontWeight: "700", color: color.light.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6, marginTop: 16 },
  input: { height: 46, borderRadius: radius.button, borderWidth: 1, borderColor: color.light.border, backgroundColor: color.light.surface, paddingHorizontal: 14, fontSize: 14.5, color: color.light.ink },
  saveBtn: { marginTop: 24, height: 48, borderRadius: radius.button, backgroundColor: color.brand.deepTeal, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
