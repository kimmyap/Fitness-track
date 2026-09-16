import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithTheme } from '@/test/renderWithTheme';
import { useEntriesStore } from '@/stores';
import { isoDate } from '@/lib/domain';
import type { LiftSetEntry } from '@/lib/types';
import { FinishWorkoutModal } from './FinishWorkoutModal';

const MIN = 60_000;
const today = isoDate();

const set = (id: string, minutesIn?: number): LiftSetEntry => ({
  id,
  exercise: 'Sumo Squats',
  weight: 135,
  sets: 1,
  reps: 8,
  date: today,
  ...(minutesIn === undefined ? {} : { createdAt: Date.now() + minutesIn * MIN }),
});

const render = () =>
  renderWithTheme(<FinishWorkoutModal open onClose={() => {}} onConfetti={vi.fn()} />);

beforeEach(() => {
  useEntriesStore.setState({ entries: [] });
});

/** The span is logging time, not session length — see sessionSpanMinutes. */
describe('FinishWorkoutModal session span', () => {
  it('reports the span alongside the other summary bits', () => {
    useEntriesStore.setState({ entries: [set('a', 0), set('b', 47)] });
    render();
    expect(screen.getByText(/47 min/)).toBeInTheDocument();
  });

  it('says nothing when the sets carry no timestamps', () => {
    useEntriesStore.setState({ entries: [set('a'), set('b')] });
    render();
    expect(screen.queryByText(/ min/)).not.toBeInTheDocument();
  });

  it('says nothing when everything was logged at once', () => {
    useEntriesStore.setState({ entries: [set('a', 0), set('b', 1)] });
    render();
    expect(screen.queryByText(/ min/)).not.toBeInTheDocument();
  });
});
