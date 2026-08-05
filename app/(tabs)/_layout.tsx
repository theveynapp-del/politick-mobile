import { Tabs } from "expo-router";
import { Newspaper, Globe2, Landmark, Bookmark, CircleUserRound } from "lucide-react-native";
import { color } from "@/lib/tokens";

/**
 * BottomNav/Bar — Destination=Today|Explore|Representatives|Saved|Profile
 * Order and labels matched to the approved Figma mockups (politic_mockups.png),
 * not the earlier component-spec ordering (Today|My Reps|Explore|Saved|You).
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.brand.deepTeal,
        tabBarInactiveTintColor: color.light.muted,
        tabBarStyle: {
          backgroundColor: color.light.surface,
          borderTopColor: color.light.border,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Today", tabBarIcon: ({ color: c, size }) => <Newspaper color={c} size={size} /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: "Explore", tabBarIcon: ({ color: c, size }) => <Globe2 color={c} size={size} /> }}
      />
      <Tabs.Screen
        name="reps"
        options={{ title: "Representatives", tabBarIcon: ({ color: c, size }) => <Landmark color={c} size={size} /> }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: "Saved", tabBarIcon: ({ color: c, size }) => <Bookmark color={c} size={size} /> }}
      />
      <Tabs.Screen
        name="you"
        options={{ title: "Profile", tabBarIcon: ({ color: c, size }) => <CircleUserRound color={c} size={size} /> }}
      />
    </Tabs>
  );
}
