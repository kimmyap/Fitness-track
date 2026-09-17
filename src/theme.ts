/**
 * Design tokens from docs/research/product-design-spec.md Part 2
 * ("Vibrant & Block-based + Dark Mode (OLED)", Fitness/Gym App palette).
 *
 * Components must consume ONLY these semantic tokens — no raw hex in
 * component files.
 */
import { useSyncExternalStore } from 'react';
import type { ResolvedTheme, ThemePref } from '@/lib/types';

export interface ThemeColors {
  primary: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  /** Success / PR accent — always pair with icon+text, never color-only. */
  accent: string;
  onAccent: string;
  /**
   * Green for TEXT / icons / chart strokes. Separate token so text and fills
   * can diverge if a palette ever needs it; currently matches `accent`.
   */
  accentText: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  destructive: string;
  onDestructive: string;
  /**
   * Red for TEXT / icons, split from `destructive` the way `accentText` is
   * split from `accent`. `destructive` is tuned as a FILL (it carries
   * `onDestructive` on top of it) and fails as text on `card`: measured
   * 3.18:1 in dark. These values clear 4.5:1 on `card`, `background` AND
   * `muted` in their own theme — dark 5.52 / 6.78 / 4.77, light 5.55 / 5.31 /
   * 5.07. Validation messages, the failed-save warning and the backup nag all
   * read through this, so it is the one that must stay legible.
   */
  destructiveText: string;
  /** Focus ring (2–4px, never removed). */
  ring: string;
  /** Modal/scrim backdrop. */
  overlay: string;
  /**
   * Achievement tiers. Used as a card border AND as the tier word on it, so
   * each is picked to clear 4.5:1 as text on `card` in its own theme — dark
   * values lightened, light values darkened. Tier is always spelled out beside
   * the colour, so none of these carry meaning on their own.
   */
  tierBronze: string;
  tierSilver: string;
  tierGold: string;
  tierPlatinum: string;
}

const darkColors: ThemeColors = {
  primary: '#F97316',
  onPrimary: '#0F172A',
  secondary: '#FB923C',
  onSecondary: '#0F172A',
  accent: '#22C55E',
  onAccent: '#0F172A',
  accentText: '#22C55E',
  background: '#1F2937',
  foreground: '#F8FAFC',
  card: '#313742',
  cardForeground: '#F8FAFC',
  muted: '#37414F',
  mutedForeground: '#CBD5E1',
  border: '#374151',
  destructive: '#EF4444',
  onDestructive: '#000000',
  destructiveText: '#FB9393',
  ring: '#F97316',
  overlay: 'rgba(0, 0, 0, 0.6)',
  tierBronze: '#D9A06B',
  tierSilver: '#C3CEDD',
  tierGold: '#F0C24B',
  tierPlatinum: '#7FD8E8',
};

const lightColors: ThemeColors = {
  primary: '#EA580C',
  onPrimary: '#FFFFFF',
  secondary: '#F97316',
  onSecondary: '#0F172A',
  accent: '#16A34A',
  onAccent: '#FFFFFF',
  accentText: '#16A34A',
  background: '#F8FAFC',
  foreground: '#0F172A',
  card: '#FFFFFF',
  cardForeground: '#0F172A',
  muted: '#F1F5F9',
  mutedForeground: '#475569',
  border: '#E2E8F0',
  destructive: '#DC2626',
  onDestructive: '#FFFFFF',
  destructiveText: '#CC1F1F',
  ring: '#EA580C',
  overlay: 'rgba(15, 23, 42, 0.5)',
  tierBronze: '#8A4F21',
  tierSilver: '#5A6B80',
  tierGold: '#8A6100',
  tierPlatinum: '#0E7490',
};

/** Spacing scale (px): --space-1 … --space-6 = 4 / 8 / 12 / 16 / 24 / 32. */
const space = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '24px',
  6: '32px',
} as const;

const radii = {
  sm: '6px',
  md: '10px',
  lg: '16px',
  full: '999px',
} as const;

/** Type scale (px): 12 / 14 / 16 / 18 / 24 / 32 / 48 (hero stat numerals). */
const fontSizes = {
  xs: '12px',
  sm: '14px',
  md: '16px',
  lg: '18px',
  xl: '24px',
  xxl: '32px',
  hero: '48px',
} as const;

const typography = {
  /** Body: DM Sans (400/500/700). Use tabular-nums for numerals/timers. */
  body: "'DM Sans', system-ui, sans-serif",
  /** Headings/display/stats: Space Grotesk (600/700). */
  display: "'Space Grotesk', 'DM Sans', system-ui, sans-serif",
  fontSizes,
  lineHeight: 1.5,
} as const;

/** Motion tokens (Subtle/Standard tier). All motion transform/opacity only, gated by prefers-reduced-motion. */
const motion = {
  duration: {
    /** Button/row hover-press. */
    fast: '150ms',
    /** Generic transitions. */
    base: '200ms',
    /** Page/route crossfade (exit capped ~250ms). */
    page: '250ms',
    /** List/card stagger entrance, scroll reveal. */
    entrance: '300ms',
    /** One-shot celebration (rest timer / PR) — the only "moment" allowed. */
    celebration: '600ms',
    /** Skeleton shimmer loop. */
    shimmer: '1400ms',
  },
  easing: {
    out: 'cubic-bezier(0.22, 1, 0.36, 1)',
    inOut: 'cubic-bezier(0.45, 0, 0.55, 1)',
  },
  /** Stagger per list item (s) — max 0.04, never > 0.1. */
  staggerSeconds: 0.03,
} as const;

export interface AppTheme {
  mode: ResolvedTheme;
  colors: ThemeColors;
  space: typeof space;
  radii: typeof radii;
  typography: typeof typography;
  motion: typeof motion;
  /** Minimum touch target (px). */
  touchTarget: '44px';
}

export const darkTheme: AppTheme = {
  mode: 'dark',
  colors: darkColors,
  space,
  radii,
  typography,
  motion,
  touchTarget: '44px',
};

export const lightTheme: AppTheme = {
  mode: 'light',
  colors: lightColors,
  space,
  radii,
  typography,
  motion,
  touchTarget: '44px',
};

export function themeFor(mode: ResolvedTheme): AppTheme {
  return mode === 'dark' ? darkTheme : lightTheme;
}

// ---------------------------------------------------------------------------
// Theme preference resolution
//
// Legacy behavior: raw `gymlog_gymlog:theme` key — dark ONLY when exactly
// "dark", light when "light". The rebuild adds `system`, stored as ABSENCE of
// the key: it follows prefers-color-scheme and defaults to light when the
// media query is unavailable (matching the legacy light default).
// ---------------------------------------------------------------------------

export function themePrefFromRaw(raw: string | null): ThemePref {
  if (raw === 'dark') return 'dark';
  if (raw === 'light') return 'light';
  return 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

export function resolveTheme(pref: ThemePref): ResolvedTheme {
  if (pref === 'dark') return 'dark';
  if (pref === 'light') return 'light';
  return systemPrefersDark() ? 'dark' : 'light';
}

/** Subscribe-able system color-scheme signal for `system` mode. */
export function useSystemPrefersDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    systemPrefersDark,
    () => false,
  );
}
