import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithTheme } from '@/test/renderWithTheme';
import { useEntriesStore, useWeightModesStore } from '@/stores';
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
  // Module-level store: a test that picks an input mode would otherwise hand
  // that mode to every test after it, in file order.
  useWeightModesStore.setState({ modes: {} });
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

/**
 * The ramp writes entries, so its logging path is tested, not just its display.
 * `warmupSet: true` is the whole reason this is safe: those entries are already
 * excluded from PBs, est-1RM, volume, the progression suggestion and the prefill.
 */
describe('LoggingForm warm-up ramp', () => {
  const openRamp = () => {
    const summary = screen.getByText(/Warm-up sets to/);
    fireEvent.click(summary);
    return summary;
  };

  it('appears only once there is something to ramp through', () => {
    renderForm();
    // Sumo Squats prefills empty, so no target and no ramp.
    expect(screen.queryByText(/Warm-up sets to/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/weight per side/i), { target: { value: '45' } });
    expect(screen.getByText(/Warm-up sets to/)).toBeInTheDocument();
  });

  it('logs a tapped row as a warm-up set, excluded from PB maths', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/weight per side/i), { target: { value: '45' } });
    openRamp();

    const rows = screen.getAllByRole('button', { name: /tap to log/i });
    expect(rows.length).toBeGreaterThan(0);
    fireEvent.click(rows[0] as HTMLElement);

    const logged = liftEntries();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ exercise: 'Sumo Squats', warmupSet: true, date: PAST_DATE });
    // Not a working set: the flags that would make it count are absent.
    expect(logged[0]?.dropSet).toBeUndefined();
    expect(logged[0]?.toFailure).toBeUndefined();
  });

  it('logs the ramp weight itself, not the working weight', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/weight per side/i), { target: { value: '45' } });
    openRamp();

    const rows = screen.getAllByRole('button', { name: /tap to log/i });
    fireEvent.click(rows[0] as HTMLElement);

    // 45 per side on a 45 lb bar = 135 total; the first ramp step is well under it.
    const logged = liftEntries()[0] as LiftSetEntry;
    expect(logged.weight).toBeLessThan(135);
    expect(logged.weight).toBeGreaterThanOrEqual(45);
  });
});

/**
 * `perSide` is a LABEL, not a modifier — it records what the reps mean and no
 * domain logic reads it. Volume deliberately does not double; see the field's
 * doc comment in types.ts for why.
 */
describe('LoggingForm per-side reps', () => {
  const toggle = () => screen.getByRole('button', { name: /reps are per side/i });

  it('is off by default and stores nothing', () => {
    renderForm();
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');

    fireEvent.change(screen.getByLabelText(/weight per side/i), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /^Log Set$/i }));

    // Absent, not false — the data rule for every optional flag.
    expect(liftEntries()[0]).not.toHaveProperty('perSide');
  });

  it('stores perSide when on, without touching the volume inputs', () => {
    renderForm();
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(screen.getByLabelText(/weight per side/i), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /^Log Set$/i }));

    const logged = liftEntries()[0] as LiftSetEntry;
    expect(logged.perSide).toBe(true);
    // reps and weight are exactly what was typed — nothing is doubled.
    expect(logged.reps).toBe(10);
    expect(logged.weight).toBe(135);
  });

  it('works on a warm-up set too — it is orthogonal to set kind', () => {
    renderForm();
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole('button', { name: /^Warm-up$/i }));
    fireEvent.change(screen.getByLabelText(/weight per side/i), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: /^Log Set$/i }));

    const logged = liftEntries()[0] as LiftSetEntry;
    expect(logged.perSide).toBe(true);
    expect(logged.warmupSet).toBe(true);
  });
});

/**
 * The post-log re-prefill used to be called without the mode/equipment/bar
 * arguments, so it fell back to mode 'auto' (variation-driven legacy math) and
 * a standard bar while the visible toggle still read whatever you had chosen.
 * The number in the box therefore changed MEANING after every set, and the
 * next tap would have logged it under the label on screen.
 */
describe('LoggingForm re-prefill keeps the chosen input mode', () => {
  const totalButton = () => screen.getByRole('button', { name: /^Total weight$/i });

  /**
   * `sessionSetType` is module-private and survives between tests, so a
   * preceding test that logged a warm-up leaves this form on Warm-up — and a
   * warm-up never feeds the prefill, which hides the bug under test.
   */
  const startWorking = () => fireEvent.click(screen.getByRole('button', { name: /^Working$/i }));

  it('leaves the total in the box after logging in Total mode', () => {
    renderForm();
    startWorking();
    fireEvent.click(totalButton());

    const weight = () => screen.getByLabelText('Total weight (lbs)');
    fireEvent.change(weight(), { target: { value: '225' } });
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /^Log Set$/i }));

    expect(liftEntries()[0]?.weight).toBe(225);
    // Was 90 — (225 - 45) / 2, the per-side reading of a field labelled Total.
    expect(weight()).toHaveValue(225);
    expect(totalButton()).toHaveAttribute('aria-pressed', 'true');
  });

  it('leaves the per-side number in the box in perSide mode', () => {
    renderForm();
    startWorking();
    fireEvent.change(screen.getByLabelText('Weight per side (lbs)'), { target: { value: '90' } });
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /^Log Set$/i }));

    expect(liftEntries()[0]?.weight).toBe(225);
    expect(screen.getByLabelText('Weight per side (lbs)')).toHaveValue(90);
  });
});
