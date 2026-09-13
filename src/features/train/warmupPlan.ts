/**
 * Warm-up session planning: which block you get, and which movements out of
 * its pool.
 *
 * Pure and DETERMINISTIC on purpose. The seed is the date, so a plan is stable
 * all day — a re-render, a tab switch or a theme change must never reshuffle
 * the list you are halfway through — but tomorrow draws a different one.
 * Shuffling advances a nonce in the caller rather than reaching for
 * Math.random here, for exactly the same reason.
 */
import {
  WARMUP_BLOCKS,
  WARMUP_CARDIO,
  WARMUP_FOCUS_LABEL,
  type WarmupFocus,
  type WarmupItem,
  type WarmupSection,
} from '@/lib/program';

export type WarmupDuration = 'quick' | 'full';

/** How many pool items the focus block contributes. Cardio is always one. */
const BLOCK_PICKS: Record<WarmupDuration, number> = { quick: 3, full: 5 };

export const WARMUP_DURATION_LABEL: Record<WarmupDuration, string> = {
  quick: 'Quick · ~5 min',
  full: 'Full · ~10 min',
};

export interface WarmupPlanItem extends WarmupItem {
  /** Stable within a plan — the tab uses it as the checkoff key. */
  key: string;
  /** Pinned items are never dropped by the rotation. */
  pinned: boolean;
}

export interface WarmupPlanSection {
  id: string;
  title: string;
  subtitle: string;
  items: WarmupPlanItem[];
}

export interface WarmupPlan {
  focus: WarmupFocus;
  focusLabel: string;
  duration: WarmupDuration;
  sections: WarmupPlanSection[];
  itemCount: number;
}

/**
 * Day name → the block that preps it.
 *
 * Matched on the NAME because days are user-editable (`gymlog:days`): a renamed
 * or custom day still classifies itself, and anything unrecognised gets the
 * full-body block rather than a guess at lower or upper. Lower is tested first
 * so "Lower Push" lands on legs.
 */
export function warmupFocusForDay(day: string | null | undefined): WarmupFocus {
  if (!day) return 'full';
  // \b on every token: without it "Warm-up" matched "arm" and Monday's
  // non-lifting day was handed an upper-body block.
  if (/\b(lower|legs?|squat|glutes?|hips?|deadlift|hamstrings?|calf|calves)/i.test(day)) return 'lower';
  if (/\b(upper|push|pull|bench|press|back|arms?|shoulders?|chest|rows?)/i.test(day)) return 'upper';
  return 'full';
}

/** FNV-1a. Small and stable across runs; nothing here is security-sensitive. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — plenty of PRNG for choosing five stretches out of ten. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `count` items from `pool`, chosen by `rand` but returned in POOL order.
 *
 * Two properties the UI depends on:
 * - Pool order survives, because the pools are written big-joints-first and a
 *   randomly ordered warm-up would undo that.
 * - The draw is a PREFIX of one shuffle, so a smaller count is always a subset
 *   of a larger one. That is what lets Quick → Full add movements without
 *   reshuffling the ones already ticked off.
 */
function pickInPoolOrder<T>(pool: T[], count: number, rand: () => number): T[] {
  const order = pool.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const swap = order[i]!;
    order[i] = order[j]!;
    order[j] = swap;
  }
  return order
    .slice(0, count)
    .sort((a, b) => a - b)
    .map((i) => pool[i]!);
}

function planSection(section: WarmupSection, count: number, rand: () => number): WarmupPlanSection {
  const toPlanItem = (item: WarmupItem, pinned: boolean): WarmupPlanItem => ({
    ...item,
    key: `${section.id}:${item.name}`,
    pinned,
  });
  return {
    id: section.id,
    title: section.title,
    subtitle: section.subtitle,
    items: [
      ...pickInPoolOrder(section.items, count, rand).map((item) => toPlanItem(item, false)),
      ...(section.pinned ?? []).map((item) => toPlanItem(item, true)),
    ],
  };
}

export interface WarmupPlanInput {
  focus: WarmupFocus;
  duration: WarmupDuration;
  /** Anything stable per session. The tab passes `${isoDate}:${shuffles}`. */
  seed: string;
}

/**
 * The cardio pick and the focus block for one session.
 *
 * `duration` is deliberately NOT part of the seed: both durations run the same
 * draw and differ only in how much of it they take, which keeps Quick a subset
 * of Full.
 */
export function buildWarmupPlan({ focus, duration, seed }: WarmupPlanInput): WarmupPlan {
  const rand = mulberry32(hashSeed(`${seed}:${focus}`));
  const sections = [
    planSection(WARMUP_CARDIO, 1, rand),
    planSection(WARMUP_BLOCKS[focus], BLOCK_PICKS[duration], rand),
  ];
  return {
    focus,
    focusLabel: WARMUP_FOCUS_LABEL[focus],
    duration,
    sections,
    itemCount: sections.reduce((n, s) => n + s.items.length, 0),
  };
}
