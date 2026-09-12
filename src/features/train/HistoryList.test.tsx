import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithTheme } from '@/test/renderWithTheme';
import { useEntriesStore } from '@/stores';
import type { LiftSetEntry } from '@/lib/types';
import { HistoryList } from './HistoryList';

const TODAY = '2026-08-28';

const setA: LiftSetEntry = { id: 'a', exercise: 'Sumo Squats', weight: 135, sets: 1, reps: 8, date: TODAY };
const setB: LiftSetEntry = { id: 'b', exercise: 'Sumo Squats', weight: 155, sets: 1, reps: 5, date: TODAY };

function renderList(onDelete: (e: LiftSetEntry) => void) {
  return renderWithTheme(
    <HistoryList
      exerciseName="Sumo Squats"
      best={null}
      todayIso={TODAY}
      onRepeat={() => {}}
      onEdit={() => {}}
      onDelete={onDelete}
    />,
  );
}

const deleteButtons = () => screen.queryAllByRole('button', { name: /^delete this set/i });
const confirmButtons = () => screen.queryAllByRole('button', { name: /^confirm delete/i });
const cancelButtons = () => screen.queryAllByRole('button', { name: /^keep this set/i });

beforeEach(() => {
  // Both sets share a date so both rows render — only the newest day auto-expands.
  useEntriesStore.setState({ entries: [setA, setB] });
});

describe('HistoryList delete confirmation', () => {
  it('does not delete on the first tap, it only arms the row', () => {
    const onDelete = vi.fn();
    renderList(onDelete);

    expect(deleteButtons()).toHaveLength(2);
    fireEvent.click(deleteButtons()[0] as HTMLElement);

    expect(onDelete).not.toHaveBeenCalled();
    expect(confirmButtons()).toHaveLength(1);
    expect(cancelButtons()).toHaveLength(1);
    expect(screen.getByText('Delete?')).toBeInTheDocument();
  });

  /*
   * The mis-tap this guards against is a second tap in the same spot. Cancel
   * takes the X's position, so the armed row must expose no "Delete this set"
   * target at all — otherwise the gate is one stray tap from being useless.
   */
  it('leaves no plain delete target on the armed row', () => {
    const onDelete = vi.fn();
    renderList(onDelete);

    fireEvent.click(deleteButtons()[0] as HTMLElement);

    // Only the other, unarmed row still offers a one-tap delete.
    expect(deleteButtons()).toHaveLength(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('deletes the armed entry on the confirm tap', () => {
    const onDelete = vi.fn();
    renderList(onDelete);

    fireEvent.click(deleteButtons()[0] as HTMLElement);
    fireEvent.click(confirmButtons()[0] as HTMLElement);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect((onDelete.mock.calls[0] as [LiftSetEntry])[0].id).toBe('a');
  });

  it('cancel disarms the row and deletes nothing', () => {
    const onDelete = vi.fn();
    renderList(onDelete);

    fireEvent.click(deleteButtons()[0] as HTMLElement);
    fireEvent.click(cancelButtons()[0] as HTMLElement);

    expect(onDelete).not.toHaveBeenCalled();
    expect(confirmButtons()).toHaveLength(0);
    expect(deleteButtons()).toHaveLength(2);
  });

  it('arming a second row disarms the first', () => {
    const onDelete = vi.fn();
    renderList(onDelete);

    fireEvent.click(deleteButtons()[0] as HTMLElement);
    // With the first row armed, the sole remaining delete target is the other row.
    fireEvent.click(deleteButtons()[0] as HTMLElement);

    expect(confirmButtons()).toHaveLength(1);
    fireEvent.click(confirmButtons()[0] as HTMLElement);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect((onDelete.mock.calls[0] as [LiftSetEntry])[0].id).toBe('b');
  });
});
