import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithTheme } from '@/test/renderWithTheme';
import { useEntriesStore } from '@/stores';
import type { Entry, LiftSetEntry } from '@/lib/types';
import { DayDetail } from './DayDetail';

const DATE = '2026-08-28';

const lift: LiftSetEntry = { id: 'l1', exercise: 'Sumo Squats', weight: 135, sets: 1, reps: 8, date: DATE };
const core: Entry = { id: 'c1', type: 'core', date: DATE };

const ids = () => useEntriesStore.getState().entries.map((e) => e.id);

function renderDay() {
  return renderWithTheme(<DayDetail date={DATE} todayIso={DATE} onMutate={() => {}} />);
}

beforeEach(() => {
  useEntriesStore.setState({ entries: [lift, core] });
});

describe('DayDetail delete confirmation', () => {
  it('does not delete a set on the first tap', () => {
    renderDay();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Sumo Squats set' }));

    expect(ids()).toContain('l1');
    expect(screen.getByRole('button', { name: 'Confirm delete of Sumo Squats set' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep Sumo Squats set' })).toBeInTheDocument();
  });

  it('deletes only on the confirm tap', () => {
    renderDay();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Sumo Squats set' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete of Sumo Squats set' }));

    expect(ids()).toEqual(['c1']);
  });

  it('cancel disarms and keeps the entry', () => {
    renderDay();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Sumo Squats set' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep Sumo Squats set' }));

    expect(ids()).toEqual(['l1', 'c1']);
    expect(screen.getByRole('button', { name: 'Delete Sumo Squats set' })).toBeInTheDocument();
  });

  /** Activity and completion rows delete through the same gate, not a bare X. */
  it('gates non-lift entries too', () => {
    renderDay();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Core Finisher entry' }));
    expect(ids()).toContain('c1');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete of Core Finisher entry' }));
    expect(ids()).toEqual(['l1']);
  });

  it('arming a second row disarms the first', () => {
    renderDay();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Sumo Squats set' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Core Finisher entry' }));

    expect(screen.queryByRole('button', { name: 'Confirm delete of Sumo Squats set' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm delete of Core Finisher entry' })).toBeInTheDocument();
  });
});
