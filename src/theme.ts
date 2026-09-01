/**
 * Design tokens from docs/research/product-design-spec.md Part 2
 * (dark-first, high-energy orange). The palette is authoritative in CLAUDE.md.
 *
 * Components must consume ONLY these semantic tokens — no raw hex in
 * component files.
 */
import { useSyncExternalStore } from 'react';
import type { ResolvedTheme, ThemePref } from '@/lib/types';

export interface ThemeColors {
  /** High-energy orange: action buttons, active set borders, focus. */
  primary: string;
  /** Text/icons ON primary — dark, because white on #FF6D00 is only 2.82:1. */
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  /** Sage green FILL for completed sets / PRs. Pair with onAccent + a checkmark. */
  accent: string;
  onAccent: string;
  /**
   * Sage green for TEXT / icons / chart strokes on dark surfaces. Lighter than
   * `accent` because #2E7D32 as text on #1E1E1E is only 3.25:1.
   */
  accentText: string;
  /** Ice blue — rest timers only. */
  timer: string;
  onTimer: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  destructive: string;
  onDestructive: string;
  /** Focus ring (2–4px, never removed). */
  ring: string;
  /** Modal/scrim backdrop. */
  overlay: string;
}

const darkColors: ThemeColors = {
  primary: '#FF6D00',
  onPrimary: '#121212',
  secondary: '#FF8A33',
  onSecondary: '#121212',
  accent: '#2E7D32',
  onAccent: '#FFFFFF',
  accentText: '#4CAF50',
  timer: '#00B0FF',
  onTimer: '#121212',
  background: '#121212',
  foreground: '#F5F5F5',
  card: '#1E1E1E',
  cardForeground: '#F5F5F5',
  muted: '#262626',
  mutedForeground: '#B3B3B3',
  border: '#333333',
  destructive: '#FF5252',
  onDestructive: '#121212',
  ring: '#FF6D00',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

const lightColors: ThemeColors = {
  primary: '#BF360C',
  onPrimary: '#FFFFFF',
  secondary: '#A63A00',
  onSecondary: '#FFFFFF',
  accent: '#2E7D32',
  onAccent: '#FFFFFF',
  accentText: '#2E7D32',
  timer: '#0277BD',
  onTimer: '#FFFFFF',
  background: '#FAFAFA',
  foreground: '#121212',
  card: '#FFFFFF',
  cardForeground: '#121212',
  muted: '#F0F0F0',
  mutedForeground: '#5A5A5A',
  border: '#D4D4D4',
  destructive: '#C62828',
  onDestructive: '#FFFFFF',
  ring: '#BF360C',
  overlay: 'rgba(0, 0, 0, 0.5)',
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
