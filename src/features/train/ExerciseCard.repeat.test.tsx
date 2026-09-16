import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithTheme } from '@/test/renderWithTheme';
import { useEntriesStore } from '@/stores';
import { DAYS } from '@/lib/program';
import type { LiftSetEntry, ProgramExercise } from '@/lib/types';
import { isLiftSet } from '@/lib/types';
import { ExerciseCard } from './ExerciseCard';

/** Keep the 1.2 MB library out of this file — nothing here reads alternatives. */
vi.mock('@/services/exerciseLibraryService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/exerciseLibraryService')>()),
  libraryAlternativesFor: vi.fn().mockResolvedValue([]),
}));

const sumoSquats = (DAYS['Lower A'] as ProgramExercise[])[0] as ProgramExercise;
const DATE = '2026-09-12';

function seed(over: Partial<LiftSetEntry>): LiftSetEntry {
  const entry: LiftSetEntry = {
    id: 'seed-1',
    exercise: sumoSquats.name,
    weight: 135,
    sets: 1,
    reps: 10,
    date: DATE,
    createdAt: 1,
    ...over,
  };
  useEntriesStore.setState({ entries: [entry] });
  return entry;
}

function renderCard() {
  renderWithTheme(
    <ExerciseCard
      exercise={sumoSquats}
      day="Lower A"
      logDate={DATE}
      todayIso={DATE}
      expanded
      onToggleExpand={() => {}}
      onSwapRequest={vi.fn()}
      onConfetti={() => {}}
    />,
  );
}

/** Opens the row's action strip and taps Repeat. */
function repeatFirstRow() {
  // The row trigger is the one RowMenu wires to its action strip via
  // aria-controls; the list also renders a personal-best line carrying the
  // same weight text, which plain text matching picks up first.
  const toggle = screen
    .getAllByRole('button')
    .find((b) => b.hasAttribute('aria-controls') && /135lbs/.test(b.textContent ?? ''));
  fireEvent.click(toggle as HTMLElement);
  fireEvent.click(screen.getByRole('button', { name: /^Repeat / }));
}

function copies(): LiftSetEntry[] {
  return useEntriesStore.getState().entries.filter(isLiftSet).filter((e) => e.id !== 'seed-1');
}

beforeEach(() => {
  useEntriesStore.setState({ entries: [] });
});

/**
 * Repeat used to forward only `warmupSet` and `assistedPullup`, so the three
 * labels added after it silently fell off the copy: repeating a drop set
 * produced a full working set that could take a PB, and repeating a per-side
 * set claimed twice the reps it recorded.
 */
describe('ExerciseCard repeat carries every set label', () => {
  it('keeps dropSet', () => {
    seed({ dropSet: true });
    renderCard();
    repeatFirstRow();
    expect(copies()[0]?.dropSet).toBe(true);
  });

  it('keeps toFailure and perSide together', () => {
    seed({ toFailure: true, perSide: true });
    renderCard();
    repeatFirstRow();

    const copy = copies()[0] as LiftSetEntry;
    expect(copy.toFailure).toBe(true);
    expect(copy.perSide).toBe(true);
  });

  it('leaves the flags ABSENT on a plain working set, not false', () => {
    seed({});
    renderCard();
    repeatFirstRow();

    const copy = copies()[0] as LiftSetEntry;
    expect(copy).not.toHaveProperty('dropSet');
    expect(copy).not.toHaveProperty('toFailure');
    expect(copy).not.toHaveProperty('perSide');
  });
});
