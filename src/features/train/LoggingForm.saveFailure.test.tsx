import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithTheme } from '@/test/renderWithTheme';
import { useAchievementsStore, useEntriesStore, useWeightModesStore } from '@/stores';
import { useToastStore } from '@/components';
import { DAYS } from '@/lib/program';
import type { ProgramExercise } from '@/lib/types';
import { LoggingForm } from './LoggingForm';

/**
 * A localStorage write can fail — quota, a locked-down private window — and
 * `setRawWithRetry` recorded that only on a global flag the Train page never
 * read. A set could therefore fail to persist while the form showed nothing
 * at all. Its own file because the mock has to replace the module the entries
 * store captured at import time.
 */
vi.mock('@/lib/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/storage')>()),
  saveEntries: vi.fn().mockResolvedValue(false),
}));

const sumoSquats = (DAYS['Lower A'] as ProgramExercise[])[0] as ProgramExercise;

function renderForm(onConfetti = vi.fn()) {
  renderWithTheme(
    <LoggingForm
      exercise={sumoSquats}
      logDate="2026-01-02"
      todayIso="2026-08-28"
      editingEntry={null}
      onFinishEdit={() => {}}
      onConfetti={onConfetti}
    />,
  );
  return onConfetti;
}

/** A first-ever set at this weight would be a PR if it were stored. */
function logOne() {
  fireEvent.click(screen.getByRole('button', { name: /^Working$/i }));
  fireEvent.change(screen.getByLabelText(/weight per side/i), { target: { value: '45' } });
  fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: /^Log Set$/i }));
}

beforeEach(() => {
  useEntriesStore.setState({ entries: [] });
  useWeightModesStore.setState({ modes: {} });
  useToastStore.setState({ toasts: [] });
  useAchievementsStore.setState({ seenAchievements: [] });
});

describe('LoggingForm when the write does not reach storage', () => {
  it('replaces the confirmation with a failure the user can act on', async () => {
    renderForm();
    logOne();

    // Optimistic first — the good case is synchronous and must not flicker.
    expect(screen.getByRole('button', { name: /^Logged$/ })).toBeInTheDocument();

    // ...then corrected once the retries give up. It points at the banner
    // WorkoutDayView now renders, rather than offering a retry that would
    // append a second copy of a set already in the array.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Not saved — see the warning above/ })).toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/could not be saved/i));
  });
});

/**
 * Celebrating a set that was never stored is the app congratulating you for
 * something it just lost — and checkAchievements PERSISTS, so an eager call
 * would also bank an achievement off that set.
 */
describe('LoggingForm celebrations are gated on the write', () => {
  it('fires no confetti, no PR toast and no achievement when the write fails', async () => {
    const onConfetti = renderForm();
    logOne();

    // Let the rejected write settle — the failure state is the signal it has.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Not saved — see the warning above/ })).toBeInTheDocument(),
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(onConfetti).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(useAchievementsStore.getState().seenAchievements).toHaveLength(0);
  });
});
