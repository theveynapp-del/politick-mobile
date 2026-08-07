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
        // Spec asks for 10-11px *and* the full word "Representatives", which
        // don't both fit a 78px tab — at 10px it still clipped to
        // "Represent…". The full label is the explicit requirement, so this
        // sits 1px under the range. Applied uniformly so all five labels stay
        // visually equal.
        tabBarLabelStyle: { fontSize: 9, lineHeight: 12, fontWeight: "500", letterSpacing: -0.3 },
        // Default leaves only ~2px between icon and label, which reads as the
        // label being stuck to the icon; this makes the spec's 4px gap.
        tabBarIconStyle: { marginBottom: 2 },
        // Each tab is only ~78px wide; default item padding left "Representatives"
        // 7px short and it truncated to "Represent…". The spec requires the full
        // word, so the padding goes rather than the label.
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
        options={{ title: "Representatives", tabBarIcon: ({ color: c }) => <Users color={c} size={24} strokeWidth={1.8} /> }}
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
