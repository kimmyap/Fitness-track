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
const row = (name: RegExp) => screen.getAllByRole('button').find((b) => name.test(b.textContent ?? '')) as HTMLElement;

function renderDay() {
  return renderWithTheme(<DayDetail date={DATE} todayIso={DATE} onMutate={() => {}} />);
}

beforeEach(() => {
  useEntriesStore.setState({ entries: [lift, core] });
});

describe('DayDetail row actions', () => {
  it('shows no delete control until the row is opened', () => {
    renderDay();
    expect(screen.queryByRole('button', { name: /^Delete/i })).not.toBeInTheDocument();

    fireEvent.click(row(/Sumo Squats/));
    expect(screen.getByRole('button', { name: 'Delete Sumo Squats set' })).toBeInTheDocument();
  });

  it('still needs a confirm tap to delete', () => {
    renderDay();
    fireEvent.click(row(/Sumo Squats/));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Sumo Squats set' }));
    expect(ids()).toContain('l1');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete of Sumo Squats set' }));
    expect(ids()).toEqual(['c1']);
  });

  it('cancel keeps the entry', () => {
    renderDay();
    fireEvent.click(row(/Sumo Squats/));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Sumo Squats set' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep Sumo Squats set' }));

    expect(ids()).toEqual(['l1', 'c1']);
  });

  /** Activity and completion rows gate identically, not with a bare X. */
  it('gates non-lift entries too', () => {
    renderDay();
    fireEvent.click(row(/Core Finisher/));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Core Finisher entry' }));
    expect(ids()).toContain('c1');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete of Core Finisher entry' }));
    expect(ids()).toEqual(['l1']);
  });

  it('opening a second row closes the first', () => {
    renderDay();
    fireEvent.click(row(/Sumo Squats/));
    fireEvent.click(row(/Core Finisher/));

    expect(screen.queryByRole('button', { name: 'Delete Sumo Squats set' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Core Finisher entry' })).toBeInTheDocument();
  });
});
