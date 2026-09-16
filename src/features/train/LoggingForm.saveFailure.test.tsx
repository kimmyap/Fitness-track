import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithTheme } from '@/test/renderWithTheme';
import { useEntriesStore, useWeightModesStore } from '@/stores';
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

beforeEach(() => {
  useEntriesStore.setState({ entries: [] });
  useWeightModesStore.setState({ modes: {} });
});

describe('LoggingForm when the write does not reach storage', () => {
  it('replaces the confirmation with a failure the user can act on', async () => {
    renderWithTheme(
      <LoggingForm
        exercise={sumoSquats}
        logDate="2026-01-02"
        todayIso="2026-08-28"
        editingEntry={null}
        onFinishEdit={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Working$/i }));
    fireEvent.change(screen.getByLabelText(/weight per side/i), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /^Log Set$/i }));

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
