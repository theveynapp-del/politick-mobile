import { Tabs } from "expo-router";
import { Home, Search, Users, Bookmark, CircleUserRound } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * BottomNav/Bar — Destination=Today|Explore|Representatives|Saved|Profile
 * Order and labels matched to the approved Figma mockups (politic_mockups.png),
 * not the earlier component-spec ordering (Today|My Reps|Explore|Saved|You).
 */
export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Ink for active, slate for inactive — per spec, not brand teal.
        tabBarActiveTintColor: "#101418",
        tabBarInactiveTintColor: "#5D6670",
        tabBarStyle: {
          height: 76 + insets.bottom,
          // React Navigation contributes ~8px of its own above the icon, so
          // this lands the 42px icon+label block at roughly 17/19 within the
          // 76px bar rather than pinned to the top.
          paddingTop: 9,
          paddingBottom: insets.bottom,
          backgroundColor: "rgba(255,255,255,0.98)",
          borderTopWidth: 1,
          borderTopColor: "#DDE1E5",
          // A fixed height overrides RN Navigation's own safe-area handling,
          // so the inset has to be added back explicitly above.
          elevation: 0,
          shadowOpacity: 0,
        },
        // "Representatives" never fit a 78px tab and forced every label down to
        // 9px to stay uniform. Shortening it to "Reps" puts the whole set back
        // in the spec's 10-11px range at a comfortable width.
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: "500", letterSpacing: -0.1 },
        // Default leaves only ~2px between icon and label, which reads as the
        // label being stuck to the icon; this makes the spec's 4px gap.
        tabBarIconStyle: { marginBottom: 2 },
        tabBarItemStyle: { paddingHorizontal: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          // Active destination reads heavier via a filled home icon, so it's
          // not distinguished by colour alone.
          tabBarIcon: ({ color: c, focused }) => (
            <Home color={c} size={24} strokeWidth={1.8} fill={focused ? c : "none"} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: "Explore", tabBarIcon: ({ color: c }) => <Search color={c} size={24} strokeWidth={1.8} /> }}
      />
      <Tabs.Screen
        name="reps"
        options={{
          title: "Reps",
          // The tab reads "Reps" to fit; screen readers get the full word.
          tabBarAccessibilityLabel: "Representatives",
          tabBarIcon: ({ color: c }) => <Users color={c} size={24} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: "Saved", tabBarIcon: ({ color: c }) => <Bookmark color={c} size={24} strokeWidth={1.8} /> }}
      />
      <Tabs.Screen
        name="you"
        options={{ title: "Profile", tabBarIcon: ({ color: c }) => <CircleUserRound color={c} size={24} strokeWidth={1.8} /> }}
      />
    </Tabs>
  );
}
