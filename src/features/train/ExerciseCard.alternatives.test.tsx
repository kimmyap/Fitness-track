import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithTheme } from '@/test/renderWithTheme';
import { useEntriesStore } from '@/stores';
import { DAYS } from '@/lib/program';
import type { CustomExercise, ProgramExercise } from '@/lib/types';
import type { SwapPrefill } from './AddExerciseSection';
import { ExerciseCard } from './ExerciseCard';

/**
 * The fallback resolves CURATED library data (868 of 876 entries ship
 * alternative_ids), so these stub the service rather than the 1.2 MB JSON —
 * what matters here is which source the card chooses and how it maps the
 * result, not the library's own contents.
 */
const libraryAlternativesFor = vi.hoisted(() => vi.fn());
vi.mock('@/services/exerciseLibraryService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/exerciseLibraryService')>()),
  libraryAlternativesFor,
}));

const sumoSquats = (DAYS['Lower A'] as ProgramExercise[])[0] as ProgramExercise;

const customExercise: CustomExercise = {
  name: 'Cable Kickback',
  goal: 40,
  targetSets: 3,
  targetReps: '12-15',
  prefillReps: 12,
  custom: true,
  notes: null,
};

function libraryEntry(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'Glute_Kickback',
    name: 'Glute Kickback',
    movement_pattern: 'HIP_HINGE',
    category: 'strength',
    level: 'beginner',
    primary_muscles: ['Glutes'],
    secondary_muscles: [],
    equipment: 'CABLE',
    execution_cues: ['Brace your core and drive the heel back.'],
    default_setup: {
      supports_plate_calculator: false,
      bar_weight_lbs: 0,
      is_unilateral: true,
      default_rest_seconds: 60,
    },
    alternative_ids: [],
    ...over,
  };
}

function renderCard(exercise: ProgramExercise | CustomExercise, onSwapRequest = vi.fn()) {
  renderWithTheme(
    <ExerciseCard
      exercise={exercise}
      day="Lower A"
      logDate="2026-09-12"
      todayIso="2026-09-12"
      expanded
      onToggleExpand={() => {}}
      onSwapRequest={onSwapRequest}
      onConfetti={() => {}}
    />,
  );
  return onSwapRequest;
}

const suggestButton = () => screen.getByRole('button', { name: /suggest an alternative/i });

beforeEach(() => {
  useEntriesStore.setState({ entries: [] });
  libraryAlternativesFor.mockReset();
  libraryAlternativesFor.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ExerciseCard alternatives', () => {
  /** The nine built-ins have hand-written reasons; nothing derived beats them. */
  it('uses the curated table and never consults the library for it', async () => {
    renderCard(sumoSquats);

    expect(suggestButton()).toBeInTheDocument();
    fireEvent.click(suggestButton());

    // Curated alternatives for Sumo Squats carry their own prose reason.
    await waitFor(() => expect(screen.getByRole('button', { name: /^Try: /i })).toBeInTheDocument());
    const label = screen.getByRole('button', { name: /^Try: /i }).textContent ?? '';
    expect(label).toMatch(/ — .+/);
    expect(label).not.toMatch(/same movement pattern/);

    expect(libraryAlternativesFor).not.toHaveBeenCalled();
  });

  it('falls back to the library when there is no curated entry, inheriting sets and reps', async () => {
    libraryAlternativesFor.mockResolvedValue([libraryEntry()]);
    const onSwapRequest = renderCard(customExercise);

    await waitFor(() => expect(libraryAlternativesFor).toHaveBeenCalledWith('Cable Kickback'));
    await waitFor(() => expect(screen.queryByRole('button', { name: /suggest an alternative/i })).toBeInTheDocument());

    fireEvent.click(suggestButton());
    const pick = await screen.findByRole('button', { name: /^Try: Glute Kickback/ });
    // Decision A: derived clause from the library metadata.
    expect(pick.textContent).toContain('same movement pattern, cable');

    fireEvent.click(screen.getByRole('button', { name: /^Swap in Glute Kickback for today$/ }));
    const prefill = (onSwapRequest.mock.calls[0] as ['oneoff' | 'recurring', SwapPrefill])[1];

    // The library carries no prescription — it comes from the slot being filled.
    expect(prefill).toMatchObject({
      name: 'Glute Kickback',
      sets: customExercise.targetSets,
      reps: customExercise.targetReps,
      muscles: 'Glutes',
    });
  });

  /** Either half missing means a bare name, not a truncated sentence. */
  it('drops the reason clause when the library entry lacks equipment', async () => {
    libraryAlternativesFor.mockResolvedValue([libraryEntry({ equipment: '' })]);
    renderCard(customExercise);

    await waitFor(() => expect(screen.queryByRole('button', { name: /suggest an alternative/i })).toBeInTheDocument());
    fireEvent.click(suggestButton());

    const pick = await screen.findByRole('button', { name: /^Try: Glute Kickback/ });
    expect(pick.textContent).not.toContain('—');
  });

  /**
   * lookupExercise refuses to guess on an ambiguous name, so the service
   * returns nothing — the card must then show no alternatives UI at all rather
   * than an empty picker.
   */
  it('renders no alternatives UI when the name does not resolve', async () => {
    libraryAlternativesFor.mockResolvedValue([]);
    renderCard(customExercise);

    await waitFor(() => expect(libraryAlternativesFor).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /suggest an alternative/i })).not.toBeInTheDocument();
  });
});
