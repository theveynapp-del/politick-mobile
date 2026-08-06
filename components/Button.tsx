import { Pressable, StyleSheet, ViewStyle, PressableProps } from "react-native";
import { Text } from "./Text";
import { color, radius } from "@/lib/tokens";

type ButtonVariant = "Primary" | "Secondary" | "Tertiary" | "Destructive";

interface ButtonProps extends PressableProps {
  variant?: ButtonVariant;
  children: string;
  style?: ViewStyle;
}

/**
 * Button/Primary | Button/Secondary | Button/Tertiary | Button/Destructive
 * Mirrors components/primitives/Button.tsx in the web (politick-app) repo.
 */
export function Button({ variant = "Primary", children, style, disabled, ...rest }: ButtonProps) {
  return (
    <Pressable
      style={[styles.base, variantStyles[variant], disabled && styles.disabled, style]}
      disabled={disabled}
      {...rest}
    >
      <Text style={[styles.label, variantTextStyles[variant]]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.button,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 50,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.45,
  },
});

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  Primary: { backgroundColor: color.brand.deepTeal },
  Secondary: { backgroundColor: color.light.surface, borderWidth: 1, borderColor: color.light.border },
  Tertiary: { backgroundColor: "transparent", paddingHorizontal: 0, minHeight: "auto" as unknown as number },
  Destructive: { backgroundColor: color.brand.actionCoral },
};

const variantTextStyles = {
  Primary: { color: "#fff" },
  Secondary: { color: color.light.ink },
  Tertiary: { color: color.brand.deepTeal },
  Destructive: { color: "#fff" },
};
