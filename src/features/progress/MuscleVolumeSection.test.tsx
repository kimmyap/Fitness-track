/**
 * The offline state, which is what this component got wrong.
 *
 * It set `ready` back to FALSE when the library failed to load, and its render
 * reads "not ready" as "still loading" — so offline with the chunk uncached it
 * showed "Loading exercise data…" forever, while RecoveryTab in the identical
 * situation said so properly. Three hand-rolled copies of one effect, drifted.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithTheme } from '@/test/renderWithTheme';
import { useEntriesStore } from '@/stores';
import { MuscleVolumeSection } from './MuscleVolumeSection';

beforeEach(() => {
  useEntriesStore.setState({ entries: [] });
});

describe('MuscleVolumeSection when the library will not load', () => {
  it('says it is unavailable rather than loading forever', async () => {
    const mod = await import('@/services/exerciseLibraryService');
    // Must be uncached, or `ready` is correct and the loader is never called.
    mod.resetExerciseLibraryCache();
    const spy = vi.spyOn(mod, 'getExerciseLibrary').mockRejectedValueOnce(new Error('offline'));

    renderWithTheme(<MuscleVolumeSection unit="lbs" />);

    await waitFor(() => expect(screen.getByText(/unavailable offline/i)).toBeInTheDocument());
    expect(screen.queryByText(/Loading exercise data/i)).not.toBeInTheDocument();

    spy.mockRestore();
    await mod.getExerciseLibrary();
  });

  it('still shows the empty state when it loads but nothing is logged', async () => {
    renderWithTheme(<MuscleVolumeSection unit="lbs" />);
    await waitFor(() => expect(screen.getByText(/No data yet/i)).toBeInTheDocument());
    expect(screen.queryByText(/unavailable offline/i)).not.toBeInTheDocument();
  });
});
