import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithTheme } from '@/test/renderWithTheme';
import { useEntriesStore } from '@/stores';
import { DAYS } from '@/lib/program';
import type { LiftSetEntry, ProgramExercise } from '@/lib/types';
import { isLiftSet } from '@/lib/types';
import { LoggingForm } from './LoggingForm';
import { useRestTimerStore } from './restTimer';

const sumoSquats = (DAYS['Lower A'] as ProgramExercise[])[0] as ProgramExercise; // Sumo Squats, 4 x 8-12

const PAST_DATE = '2026-01-02';

function renderForm(overrides: Partial<Parameters<typeof LoggingForm>[0]> = {}) {
  return renderWithTheme(
    <LoggingForm
      exercise={sumoSquats}
      logDate={PAST_DATE}
      todayIso="2026-08-28"
      editingEntry={null}
      onFinishEdit={() => {}}
      {...overrides}
    />,
  );
}

function liftEntries(): LiftSetEntry[] {
  return useEntriesStore.getState().entries.filter(isLiftSet);
}

beforeEach(() => {
  useEntriesStore.setState({ entries: [] });
  useRestTimerStore.getState().reset();
});

afterEach(() => {
  useRestTimerStore.getState().reset();
});

describe('LoggingForm weight math display', () => {
  it('shows the barbell per-side helper and computes the total live', () => {
    renderForm();
    // Sumo Squats defaults to its first variation, Barbell
    const weightInput = screen.getByLabelText(/weight per side \(lbs\)/i);
    expect(screen.getByText('Enter weight per side, bar (45lbs) added automatically')).toBeInTheDocument();

    fireEvent.change(weightInput, { target: { value: '45' } });
    expect(screen.getByText('= 135lbs total (45 per side x2 + 45lbs bar)')).toBeInTheDocument();
  });

  it('switches the math when the variation changes to Dumbbell (input value kept, like legacy)', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/weight per side/i), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText('Variation'), { target: { value: 'Dumbbell' } });

    expect(screen.getByLabelText(/weight per dumbbell \(lbs\)/i)).toHaveValue(45);
    expect(screen.getByText('= 90lbs total (45lbs x2 dumbbells)')).toBeInTheDocument();
  });

  it('stores the computed barbell total in lbs when logging', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/weight per side/i), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log Set' }));

    const sets = liftEntries();
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({
      exercise: 'Sumo Squats',
      weight: 85, // 20 per side x2 + 45 bar
      reps: 10,
      sets: 1,
      date: PAST_DATE,
      variation: 'Barbell',
    });
    // optional fields stay ABSENT, not null/false
    expect(sets[0]).not.toHaveProperty('warmupSet');
    expect(sets[0]).not.toHaveProperty('rpe');
  });
});

describe('LoggingForm typo guard (>40% jump)', () => {
  beforeEach(() => {
    useEntriesStore.setState({
      entries: [
        { id: 'seed1', exercise: 'Sumo Squats', weight: 100, sets: 1, reps: 10, date: '2026-01-01' },
      ],
    });
  });

  it('requires a second tap when the new weight jumps more than 40%', () => {
    renderForm();
    // per-side 60 → 60*2+45 = 165 stored, a 65% jump from 100
    fireEvent.change(screen.getByLabelText(/weight per side/i), { target: { value: '60' } });

    fireEvent.click(screen.getByRole('button', { name: 'Log Set' }));
    expect(
      screen.getByRole('button', { name: "That's a big jump, tap again to confirm" }),
    ).toBeInTheDocument();
    expect(liftEntries()).toHaveLength(1); // nothing logged yet

    fireEvent.click(screen.getByRole('button', { name: "That's a big jump, tap again to confirm" }));
    const sets = liftEntries();
    expect(sets).toHaveLength(2);
    expect(sets[1]?.weight).toBe(165);
  });

  it('disarms the guard after the 4s window', () => {
    vi.useFakeTimers();
    try {
      renderForm();
      fireEvent.change(screen.getByLabelText(/weight per side/i), { target: { value: '60' } });
      fireEvent.click(screen.getByRole('button', { name: 'Log Set' }));
      expect(
        screen.getByRole('button', { name: "That's a big jump, tap again to confirm" }),
      ).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.getByRole('button', { name: 'Log Set' })).toBeInTheDocument();
      expect(liftEntries()).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not guard sane progressions', () => {
    renderForm();
    // per-side 35 → 115 stored, a 15% jump — fine
    fireEvent.change(screen.getByLabelText(/weight per side/i), { target: { value: '35' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log Set' }));
    expect(liftEntries()).toHaveLength(2);
  });
});

describe('LoggingForm log lock (800ms) + Saving state', () => {
  it('blocks double-taps and shows Saving... until the lock releases', () => {
    vi.useFakeTimers();
    try {
      renderForm();
      fireEvent.change(screen.getByLabelText(/weight per side/i), { target: { value: '20' } });
      fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '10' } });

      fireEvent.click(screen.getByRole('button', { name: 'Log Set' }));
      const savingBtn = screen.getByRole('button', { name: 'Saving...' });
      expect(savingBtn).toBeDisabled();
      expect(liftEntries()).toHaveLength(1);

      // a frantic double-tap within the lock window logs nothing extra
      fireEvent.click(savingBtn);
      expect(liftEntries()).toHaveLength(1);

      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(screen.getByRole('button', { name: 'Log Set' })).not.toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('LoggingForm field order', () => {
  /**
   * The set type decides what the numbers count toward, so it has to be in the
   * same glance as them. Pinned in the DOM rather than by eye: it previously
   * sat above the plate controls, far enough up that a mis-set type was only
   * visible after scrolling back.
   */
  it('puts the set-type picker directly above the weight input', () => {
    renderForm();
    const picker = screen.getByRole('group', { name: 'Set type' });
    const weight = screen.getByLabelText(/weight per side/i);

    const order = picker.compareDocumentPosition(weight);
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // …and below the plate-mode toggle, which belongs with the weight label.
    const modes = screen.getByRole('group', { name: 'Weight entry mode' });
    expect(modes.compareDocumentPosition(picker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
