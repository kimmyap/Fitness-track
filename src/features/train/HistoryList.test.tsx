import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithTheme } from '@/test/renderWithTheme';
import { useEntriesStore } from '@/stores';
import type { LiftSetEntry } from '@/lib/types';
import { HistoryList } from './HistoryList';

const TODAY = '2026-08-28';

const setA: LiftSetEntry = { id: 'a', exercise: 'Sumo Squats', weight: 135, sets: 1, reps: 8, date: TODAY, rpe: 8 };
const setB: LiftSetEntry = { id: 'b', exercise: 'Sumo Squats', weight: 155, sets: 1, reps: 5, date: TODAY };

function renderList(onDelete: (e: LiftSetEntry) => void = () => {}, onRepeat = () => {}, onEdit = () => {}) {
  return renderWithTheme(
    <HistoryList
      exerciseName="Sumo Squats"
      best={null}
      todayIso={TODAY}
      onRepeat={onRepeat}
      onEdit={onEdit}
      onDelete={onDelete}
    />,
  );
}

/** The day header is also a disclosure, so match set rows by their label column. */
const rowButtons = () => screen.getAllByRole('button').filter((b) => /^(Set \d|Warm-up)/.test(b.textContent ?? ''));
const openRow = (i = 0) => fireEvent.click(rowButtons()[i] as HTMLElement);

beforeEach(() => {
  // Both sets share a date so both rows render — only the newest day auto-expands.
  useEntriesStore.setState({ entries: [setA, setB] });
});

describe('HistoryList row layout', () => {
  it('lays each set out as set label, load and status', () => {
    renderList();
    const row = rowButtons()[0] as HTMLElement;

    expect(row).toHaveTextContent('Set 1');
    // Load column carries weight, reps and RPE as one tabular string.
    expect(row).toHaveTextContent('135lbs × 8 @8');
  });

  it('carries no inline action buttons on the row itself', () => {
    renderList();
    expect(screen.queryByRole('button', { name: /^Repeat/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Delete/i })).not.toBeInTheDocument();
  });

  it('marks a personal best with a word, not only a colour', () => {
    renderWithTheme(
      <HistoryList
        exerciseName="Sumo Squats"
        best={setB}
        todayIso={TODAY}
        onRepeat={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText('personal best')).toBeInTheDocument();
  });
});

describe('HistoryList row actions', () => {
  it('opens that row’s actions when the row is tapped', () => {
    renderList();
    openRow(0);

    expect(screen.getByRole('button', { name: /^Repeat Set 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Edit Set 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Delete this set/i })).toBeInTheDocument();
  });

  it('opening a second row closes the first', () => {
    renderList();
    openRow(0);
    openRow(1);

    expect(screen.queryByRole('button', { name: /^Repeat Set 1/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Repeat Set 2/i })).toBeInTheDocument();
  });

  it('tapping the open row again closes it', () => {
    renderList();
    openRow(0);
    openRow(0);

    expect(screen.queryByRole('button', { name: /^Repeat Set 1/i })).not.toBeInTheDocument();
  });

  it('still gates delete behind a confirm inside the strip', () => {
    const onDelete = vi.fn();
    renderList(onDelete);
    openRow(0);

    fireEvent.click(screen.getByRole('button', { name: /^Delete this set/i }));
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^Confirm delete/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect((onDelete.mock.calls[0] as [LiftSetEntry])[0].id).toBe('a');
  });

  it('repeat and edit report the row they were opened from', () => {
    const onRepeat = vi.fn();
    const onEdit = vi.fn();
    renderList(() => {}, onRepeat, onEdit);

    openRow(1);
    fireEvent.click(screen.getByRole('button', { name: /^Repeat Set 2/i }));
    expect(onRepeat).toHaveBeenCalledTimes(1);

    openRow(1);
    fireEvent.click(screen.getByRole('button', { name: /^Edit Set 2/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
