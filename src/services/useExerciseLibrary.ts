/**
 * Load the lazy exercise library from a component, once, with a real status.
 *
 * WHY THIS EXISTS. Three components each hand-rolled the same mount effect —
 * a `ready` flag, a cancelled/active guard, a `.catch`. They drifted, and the
 * drift was a defect rather than a style difference: on a failed load
 * `MuscleVolumeSection` set `ready` back to FALSE, which its own render treats
 * as "still loading", so offline with the chunk uncached it showed
 * "Loading exercise data…" forever. `RecoveryTab` had a separate `failed`
 * state and said so properly. Same situation, two answers, one of them wrong.
 *
 * A failure is therefore a FIRST-CLASS status here, not the absence of
 * success — that is the distinction the copies lost.
 *
 * The 1.2 MB JSON is still reached only through `getExerciseLibrary`'s dynamic
 * import, so this hook does not make it eager. `enabled` defers the load
 * further for callers that should not fetch until something is opened.
 */
import { useCallback, useEffect, useState } from 'react';
import { getExerciseLibrary, getLoadedLibrary, type LibraryExercise } from './exerciseLibraryService';

export type LibraryStatus = 'idle' | 'loading' | 'ready' | 'failed';

export interface UseExerciseLibrary {
  status: LibraryStatus;
  /** The rows once loaded, else null. Never triggers a fetch by being read. */
  library: LibraryExercise[] | null;
  /**
   * Try again after a failure. `getExerciseLibrary` clears its cached promise
   * on rejection, so a retry really does re-fetch rather than re-reading the
   * same failure.
   */
  retry: () => void;
}

export function useExerciseLibrary(enabled = true): UseExerciseLibrary {
  /*
   * Seeded from the module cache so a second consumer that mounts after the
   * library is already in memory renders ready on its FIRST paint, rather than
   * flashing a loading state for a fetch that will not happen.
   */
  const [state, setState] = useState<{ status: LibraryStatus; library: LibraryExercise[] | null }>(
    () => {
      const cached = getLoadedLibrary();
      if (cached) return { status: 'ready', library: cached };
      return { status: enabled ? 'loading' : 'idle', library: null };
    },
  );
  /** Bumped by `retry`; the effect keys off it so a retry re-runs the load. */
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    if (state.status === 'ready') return;

    let active = true;
    setState((prev) => (prev.status === 'loading' ? prev : { status: 'loading', library: null }));

    void getExerciseLibrary()
      .then((library) => {
        if (active) setState({ status: 'ready', library });
      })
      .catch(() => {
        // Offline with the chunk uncached. A distinct status, so the caller can
        // say so instead of showing a spinner that will never resolve.
        if (active) setState({ status: 'failed', library: null });
      });

    return () => {
      active = false;
    };
    // `state.status` is deliberately not a dependency: re-running on every
    // status change would restart the load the moment it failed. `attempt` is,
    // because bumping it is exactly how a caller asks for another go.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, enabled]);

  return { ...state, retry };
}
