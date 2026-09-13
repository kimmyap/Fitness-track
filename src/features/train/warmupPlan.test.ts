import { describe, it, expect } from 'vitest';
import { WARMUP_BLOCKS, WARMUP_CARDIO } from '@/lib/program';
import { buildWarmupPlan, warmupFocusForDay } from './warmupPlan';

const plan = (seed: string, duration: 'quick' | 'full' = 'full', focus: 'lower' | 'upper' | 'full' = 'lower') =>
  buildWarmupPlan({ focus, duration, seed });

const names = (p: ReturnType<typeof plan>) => p.sections.flatMap((s) => s.items.map((i) => i.name));

describe('warmupFocusForDay', () => {
  it('maps the built-in program days', () => {
    expect(warmupFocusForDay('Lower A')).toBe('lower');
    expect(warmupFocusForDay('Lower B')).toBe('lower');
    expect(warmupFocusForDay('Upper')).toBe('upper');
  });

  /** Days are user-editable, so classification has to survive a rename. */
  it('classifies custom day names, lower winning a tie', () => {
    expect(warmupFocusForDay('Leg Day')).toBe('lower');
    expect(warmupFocusForDay('Pull Day')).toBe('upper');
    expect(warmupFocusForDay('Bench + Rows')).toBe('upper');
    expect(warmupFocusForDay('Lower Push')).toBe('lower');
  });

  /** A non-lifting day gets the full-body block, never a guess. */
  it('falls back to full body for no day or an unrecognised one', () => {
    expect(warmupFocusForDay(null)).toBe('full');
    expect(warmupFocusForDay(undefined)).toBe('full');
    expect(warmupFocusForDay('Warm-up')).toBe('full');
    expect(warmupFocusForDay('Volleyball')).toBe('full');
  });
});

describe('buildWarmupPlan', () => {
  it('always draws exactly one cardio option', () => {
    const cardio = plan('2026-09-12:0').sections[0];
    expect(cardio?.id).toBe('cardio');
    expect(cardio?.items).toHaveLength(1);
    expect(WARMUP_CARDIO.items.map((i) => i.name)).toContain(cardio?.items[0]?.name);
  });

  /**
   * The whole point of seeding by date: a re-render, a tab switch or a theme
   * change must not reshuffle a list you are halfway through.
   */
  it('is stable for one seed and differs across days', () => {
    expect(names(plan('2026-09-12:0'))).toEqual(names(plan('2026-09-12:0')));
    expect(names(plan('2026-09-12:0'))).not.toEqual(names(plan('2026-09-13:0')));
  });

  it('draws a different set when the shuffle nonce advances', () => {
    expect(names(plan('2026-09-12:0'))).not.toEqual(names(plan('2026-09-12:1')));
  });

  /** Quick → Full must ADD movements, not replace the ones already ticked. */
  it('makes the quick draw a subset of the full one', () => {
    for (const day of ['2026-09-12:0', '2026-09-13:0', '2026-11-01:3']) {
      const quick = names(plan(day, 'quick'));
      const full = names(plan(day, 'full'));
      expect(quick.length).toBeLessThan(full.length);
      for (const name of quick) expect(full).toContain(name);
    }
  });

  it('counts 4 movements quick and 6 full on a lifting day', () => {
    // 1 cardio + 3 or 5 from the block + 1 pinned warm-up-set reminder.
    expect(plan('2026-09-12:0', 'quick').itemCount).toBe(5);
    expect(plan('2026-09-12:0', 'full').itemCount).toBe(7);
  });

  it('keeps the pinned warm-up sets last and out of the rotation', () => {
    for (let n = 0; n < 6; n++) {
      const block = plan(`2026-09-12:${n}`).sections[1];
      const last = block?.items.at(-1);
      expect(last?.pinned).toBe(true);
      expect(last?.name).toBe('Light warm-up sets on first lift');
      expect(block?.items.filter((i) => i.pinned)).toHaveLength(1);
    }
  });

  /** Nothing to pin on a non-lifting day — there is no first lift. */
  it('pins nothing on the full-body block', () => {
    const block = plan('2026-09-12:0', 'full', 'full').sections[1];
    expect(block?.items.some((i) => i.pinned)).toBe(false);
    expect(plan('2026-09-12:0', 'full', 'full').itemCount).toBe(6);
  });

  /** Pools read big-joints-first; a randomly ORDERED warm-up would undo that. */
  it('presents picks in pool order', () => {
    const pool = WARMUP_BLOCKS.lower.items.map((i) => i.name);
    for (let n = 0; n < 6; n++) {
      const drawn = plan(`2026-09-12:${n}`)
        .sections[1]!.items.filter((i) => !i.pinned)
        .map((i) => pool.indexOf(i.name));
      expect(drawn).toEqual([...drawn].sort((a, b) => a - b));
    }
  });

  it('labels the focus for display', () => {
    expect(plan('2026-09-12:0', 'full', 'upper').focusLabel).toBe('Upper body');
  });
});
