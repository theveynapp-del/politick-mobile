import {
  TrendingUp, Home, HeartPulse, Users, Globe, GraduationCap,
  Leaf, Cpu, Receipt, Zap, ShieldCheck, Bus, Landmark, LucideIcon,
} from "lucide-react-native";

/**
 * Icon and tint per issue.
 *
 * The hues are muted and assigned by subject, never by ideology — no issue
 * gets a party colour, and saturated red/blue pairings are avoided so a row of
 * chips can't read as a partisan spectrum.
 */
export const ISSUE_META: Record<string, { icon: LucideIcon; color: string }> = {
  Economy: { icon: TrendingUp, color: "#167D79" },
  Housing: { icon: Home, color: "#0D5F5B" },
  Healthcare: { icon: HeartPulse, color: "#B0574A" },
  Immigration: { icon: Users, color: "#4F6D7A" },
  Trade: { icon: Globe, color: "#2E7D8F" },
  Education: { icon: GraduationCap, color: "#6E5EA0" },
  Climate: { icon: Leaf, color: "#6B8F3F" },
  Technology: { icon: Cpu, color: "#5D6670" },
  Taxes: { icon: Receipt, color: "#C08A2E" },
  Energy: { icon: Zap, color: "#C4772E" },
  "Public safety": { icon: ShieldCheck, color: "#4F6D7A" },
  Transportation: { icon: Bus, color: "#2E7D8F" },
  "Foreign policy": { icon: Landmark, color: "#6E5EA0" },
};

export const CORE_ISSUES = [
  "Economy", "Housing", "Healthcare", "Immigration", "Trade",
  "Education", "Climate", "Technology", "Taxes", "Energy",
];

export const EXTRA_ISSUES = ["Public safety", "Transportation", "Foreign policy"];
