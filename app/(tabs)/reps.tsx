import { useEffect, useState } from "react";
import { View, Pressable, Image, StyleSheet, FlatList } from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { color, radius } from "@/lib/tokens";
import { supabase } from "@/lib/supabase";
import { getRepresentativesByZip } from "@/lib/queries";
import { Representative, RepLevel } from "@/lib/types";
import { getStoredZip } from "@/lib/onboarding";

const DEFAULT_ZIP = "20814";
const groupOrder: RepLevel[] = ["Federal", "State", "County", "Local"];

export default function RepsScreen() {
  const router = useRouter();
  const [reps, setReps] = useState<Representative[]>([]);
  const [loading, setLoading] = useState(true);
  const [zip, setZip] = useState(DEFAULT_ZIP);

  useEffect(() => {
    getStoredZip().then((stored) => {
      const activeZip = stored && stored.length === 5 ? stored : DEFAULT_ZIP;
      setZip(activeZip);
      getRepresentativesByZip(supabase, activeZip).then((data) => {
        setReps(data);
        setLoading(false);
      });
    });
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Your representatives</Text>
        <Text style={styles.subtitle}>ZIP {zip} · what each office controls</Text>
      </View>
      <FlatList
        data={groupOrder.flatMap((level) => reps.filter((r) => r.level === level))}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No representative data for this ZIP yet.</Text> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/representative/${item.id}`)}>
            <View style={styles.avatar}>
              {item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{item.name.split(" ").slice(-1)[0].slice(0, 2).toUpperCase()}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.level}>{item.level}</Text>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.role}>{item.role}</Text>
            </View>
            <ChevronRight size={18} color={color.light.muted} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.light.canvas },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 20, fontWeight: "700", color: color.light.ink, marginBottom: 3 },
  subtitle: { fontSize: 13, color: color.light.muted },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: color.light.surface, borderWidth: 1, borderColor: color.light.border, borderRadius: radius.card, padding: 14, marginBottom: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: color.brand.softTeal, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: 42, height: 42 },
  avatarText: { fontSize: 13, fontWeight: "800", color: color.brand.deepTeal },
  level: { fontSize: 10.5, fontWeight: "800", color: color.brand.deepTeal, marginBottom: 2 },
  name: { fontSize: 14.5, fontWeight: "700", color: color.light.ink },
  role: { fontSize: 12, color: color.light.muted, marginTop: 1 },
  emptyText: { textAlign: "center", color: color.light.muted, fontSize: 13.5, padding: 48 },
});
