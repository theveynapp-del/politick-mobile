import { View, Image, StyleSheet, StyleProp, ViewStyle } from "react-native";

/**
 * The Politick placeholder for stories that ship without a photograph.
 *
 * The same cream is baked into the asset's background, so a slot wider or
 * taller than the artwork letterboxes seamlessly instead of showing a seam
 * where the image ends.
 */
export const STORY_PLACEHOLDER_BG = "#FDFAF3";

export function StoryPlaceholder({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    // Decorative: it stands in for a missing photo and carries no information
    // a screen reader should announce on every image-less story.
    // The cream is applied last on purpose: the callers' slot styles carry
    // their own backgroundColor, and letting one through would show as a band
    // beside the artwork wherever the slot isn't square.
    <View
      style={[styles.frame, style, { backgroundColor: STORY_PLACEHOLDER_BG }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={require("@/assets/story-placeholder.png")}
        style={styles.art}
        resizeMode="contain"
        accessibilityLabel=""
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: STORY_PLACEHOLDER_BG, overflow: "hidden" },
  art: { width: "100%", height: "100%" },
});
