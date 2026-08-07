import { ComponentType } from "react";
import { View, StyleSheet, ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { Home, Search, Users, Bookmark, CircleUserRound, LucideProps } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/Text";

/**
 * BottomNav/Bar — Destination=Today|Explore|Reps|Saved|Profile
 * Order matched to the approved Figma mockups (politic_mockups.png), not the
 * earlier component-spec ordering (Today|My Reps|Explore|Saved|You).
 */

/**
 * Icon plus the active accent. The bar is absolutely positioned so turning it
 * on doesn't shift the icon or label, and -9 cancels the tab bar's paddingTop
 * so it sits on the top border rather than floating below it.
 */
function TabIcon({
  Icon,
  color,
  focused,
  filled,
}: {
  Icon: ComponentType<LucideProps>;
  color: ColorValue;
  focused: boolean;
  filled?: boolean;
}) {
  return (
    <View style={styles.iconWrap}>
      {focused ? <View style={styles.accent} /> : null}
      <Icon color={color as string} size={24} strokeWidth={focused ? 2 : 1.8} fill={filled && focused ? (color as string) : "none"} />
    </View>
  );
}

/**
 * The active destination is marked three ways — accent bar, heavier weight and
 * darker ink — so it never depends on colour alone to be readable.
 */
function TabLabel({ focused, color, children }: { focused: boolean; color: ColorValue; children: string }) {
  return (
    <Text style={[styles.label, focused && styles.labelActive, { color }]} numberOfLines={1}>
      {children}
    </Text>
  );
}

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
          // this lands the icon+label block at roughly 17/19 within the 76px
          // bar rather than pinned to the top.
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
        tabBarLabel: ({ focused, color, children }) => (
          <TabLabel focused={focused} color={color}>
            {children}
          </TabLabel>
        ),
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
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={Home} color={color} focused={focused} filled />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={Search} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="reps"
        options={{
          title: "Reps",
          // The tab reads "Reps" to fit; screen readers get the full word.
          tabBarAccessibilityLabel: "Representatives",
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={Users} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={Bookmark} color={color} focused={focused} filled />,
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={CircleUserRound} color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: "center", justifyContent: "center" },
  accent: {
    position: "absolute",
    top: -9,
    width: 26,
    height: 3,
    borderRadius: 999,
    backgroundColor: "#167D79",
  },
  label: { fontSize: 11, lineHeight: 14, fontWeight: "500", letterSpacing: -0.1 },
  labelActive: { fontWeight: "700" },
});
