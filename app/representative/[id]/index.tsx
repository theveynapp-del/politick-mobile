import { useState, useEffect } from "react";
import { View, Pressable, Image, ScrollView, StyleSheet, Linking } from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, MoreHorizontal, Phone, Mail, Globe, Navigation } from "lucide-react-native";
import { color, radius } from "@/lib/tokens";
import { supabase } from "@/lib/supabase";
import { getRepresentativesByZip } from "@/lib/queries";
import { Representative } from "@/lib/types";

export default function RepresentativeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "votes" | "activity" | "about">("overview");
  const [rep, setRep] = useState<Representative | null>(null);

  useEffect(() => {
    getRepresentativesByZip(supabase, "20814").then((all) => setRep(all.find((r) => r.id === id) ?? null));
  }, [id]);

  if (!rep) return null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.appbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={24} color={color.light.ink} />
        </Pressable>
        <Text style={styles.appbarTitle}>Representative</Text>
        <MoreHorizontal size={20} color={color.light.ink} />
      </View>

      <ScrollView>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            {rep.photoUrl ? (
              <Image source={{ uri: rep.photoUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{rep.name.split(" ").slice(-1)[0].slice(0, 2).toUpperCase()}</Text>
            )}
          </View>
          <Text style={styles.name}>{rep.name}</Text>
          <Text style={styles.role}>{rep.role}</Text>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <Pressable style={styles.contactBtn}>
            <Text style={styles.contactBtnText}>Contact Office</Text>
          </Pressable>
        </View>

        <View style={styles.contactGrid}>
          {[
            { icon: Phone, label: "Call", action: () => rep.phone && Linking.openURL(`tel:${rep.phone}`), disabled: !rep.phone },
            { icon: Mail, label: "Email", action: undefined, disabled: true },
            { icon: Globe, label: "Website", action: () => rep.website && Linking.openURL(rep.website), disabled: !rep.website },
            { icon: Navigation, label: "Directions", action: undefined, disabled: true },
          ].map(({ icon: Icon, label, action, disabled }) => (
            <Pressable key={label} style={[styles.contactAction, disabled && styles.contactActionDisabled]} onPress={action} disabled={disabled}>
              <Icon size={16} color={disabled ? color.light.muted : color.light.ink} />
              <Text style={[styles.contactActionText, disabled && { color: color.light.muted }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.segmented}>
          {(["overview", "votes", "activity", "about"] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.segmentBtn, tab === t && styles.segmentBtnActive]}>
              <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ padding: 20 }}>
          {(tab === "overview" || tab === "about") && (
            <View style={styles.officeCard}>
              <Text style={styles.officeLabel}>WHAT THIS OFFICE DOES</Text>
              <Text style={styles.officeBody}>{rep.controls}</Text>
            </View>
          )}
          {tab === "activity" && (
            <View style={styles.activityRow}>
              <Text style={styles.activityTitle}>No recorded action found</Text>
              <Text style={styles.activityDesc}>Checked today — nothing tracked yet for this representative on current bills.</Text>
            </View>
          )}
          {tab === "votes" && (
            <View style={styles.activityRow}>
              <Text style={styles.activityTitle}>No recorded votes found</Text>
              <Text style={styles.activityDesc}>This demo profile has no tracked voting record yet.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.light.canvas },
  appbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 56, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: color.light.border, backgroundColor: color.light.surface },
  appbarTitle: { fontSize: 14, fontWeight: "700", color: color.light.ink },
  hero: { alignItems: "center", padding: 24, borderBottomWidth: 1, borderBottomColor: color.light.border },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: color.brand.softTeal, alignItems: "center", justifyContent: "center", marginBottom: 12, overflow: "hidden" },
  avatarImage: { width: 76, height: 76 },
  avatarText: { fontSize: 22, fontWeight: "800", color: color.brand.deepTeal },
  name: { fontSize: 21, fontWeight: "800", color: color.light.ink, marginBottom: 3 },
  role: { fontSize: 13, color: color.light.muted },
  contactBtn: { backgroundColor: color.brand.deepTeal, borderRadius: radius.button, height: 48, alignItems: "center", justifyContent: "center" },
  contactBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  contactGrid: { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  contactAction: { flex: 1, borderWidth: 1, borderColor: color.light.border, borderRadius: 12, paddingVertical: 12, alignItems: "center", gap: 4 },
  contactActionDisabled: { opacity: 0.4 },
  contactActionText: { fontSize: 10.5, fontWeight: "700", color: color.light.ink },
  segmented: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: color.light.border },
  segmentBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  segmentBtnActive: { borderBottomColor: color.brand.signalGold },
  segmentText: { fontSize: 12.5, fontWeight: "700", color: color.light.muted },
  segmentTextActive: { color: color.brand.deepTeal },
  officeCard: { backgroundColor: color.light.surface, borderWidth: 1, borderColor: color.light.border, borderRadius: radius.card, padding: 16 },
  officeLabel: { fontSize: 10.5, fontWeight: "800", color: color.brand.deepTeal, marginBottom: 8, letterSpacing: 0.4 },
  officeBody: { fontSize: 14, lineHeight: 20, color: color.light.ink },
  activityRow: { backgroundColor: color.light.surface, borderWidth: 1, borderColor: color.light.border, borderRadius: radius.card, padding: 16 },
  activityTitle: { fontSize: 14, fontWeight: "700", color: color.light.ink, marginBottom: 4 },
  activityDesc: { fontSize: 12.5, color: color.light.muted, lineHeight: 18 },
});
