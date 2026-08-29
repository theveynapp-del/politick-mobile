import { View } from "react-native";
import { Text } from "./Text";
import { color } from "@/lib/tokens";

/**
 * The "Rotunda" wordmark with the single gold signal dot — per the
 * brand guide, this is the only decorative brand accent allowed.
 */
export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
      <Text style={{ fontSize: size, fontWeight: "800", color: color.light.ink, letterSpacing: -0.3 }}>
        Rotunda
      </Text>
      <View
        style={{
          width: size * 0.16,
          height: size * 0.16,
          borderRadius: 99,
          backgroundColor: color.brand.signalGold,
          marginTop: size * 0.2,
          marginLeft: 2,
        }}
      />
    </View>
  );
}
