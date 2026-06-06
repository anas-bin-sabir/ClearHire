/**
 * ClearHire Design System — semantic token definitions.
 * CSS variables are applied in globals.css; use Tailwind utilities
 * (bg-background, text-foreground, etc.) or var(--token) in components.
 */

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** CSS custom property names (without -- prefix) */
export const tokens = {
  background: "background",
  foreground: "foreground",
  card: "card",
  cardElevated: "card-elevated",
  border: "border",
  primary: "primary",
  secondary: "secondary",
  success: "success",
  warning: "warning",
  danger: "danger",
  muted: "muted",
  mutedForeground: "muted-foreground",
  ring: "ring",
} as const;

export type TokenName = (typeof tokens)[keyof typeof tokens];

/** Resolve var(--name) for inline styles when Tailwind utilities aren't enough */
export function cssVar(name: TokenName): string {
  return `var(--${name})`;
}

export function cssVarRgb(name: `${TokenName}-rgb`): string {
  return `var(--${name})`;
}

/** Brand palette reference (documentation + programmatic use) */
export const palette = {
  light: {
    primary: "#2563EB",
    secondary: "#0F172A",
    success: "#16A34A",
    warning: "#D97706",
    danger: "#DC2626",
    background: "#FFFFFF",
    card: "#F8FAFC",
    border: "#E2E8F0",
    foreground: "#0F172A",
    muted: "#64748B",
  },
  dark: {
    primary: "#3B82F6",
    secondary: "#0F172A",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
    background: "#020617",
    card: "#0F172A",
    cardElevated: "#1E293B",
    border: "#334155",
    foreground: "#F8FAFC",
    muted: "#94A3B8",
  },
} as const;

/** Graph node category colors */
export const graphNodeColors = {
  freelancer: "#3B82F6",
  project: "#22C55E",
  skill: "#A855F7",
  fraudRing: "#EF4444",
} as const;

/** Fraud score thresholds (0–100 scale) */
export const fraudThresholds = {
  low: 30,
  medium: 60,
} as const;

export function fraudRiskLevel(pct: number): "low" | "medium" | "high" {
  if (pct <= fraudThresholds.low) return "low";
  if (pct <= fraudThresholds.medium) return "medium";
  return "high";
}
