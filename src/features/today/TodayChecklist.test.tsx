import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithTheme } from '@/test/renderWithTheme';
import { useEntriesStore } from '@/stores';
import { isActivity } from '@/lib/types';
import { TodayChecklist } from './TodayChecklist';

const TODAY = '2026-09-12';

const render = () => renderWithTheme(<TodayChecklist todayIso={TODAY} onConfetti={() => {}} />);

beforeEach(() => {
  useEntriesStore.setState({ entries: [] });
});

describe('TodayChecklist', () => {
  /** Each item owns its trigger now, rather than sharing a block underneath. */
  it('gives every loggable item its own trigger', () => {
    render();

    expect(screen.getByRole('button', { name: 'Log Warm-up for today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log Pilates for today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log Volleyball for today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log Core Finisher for today' })).toBeInTheDocument();
  });

  /** Sets are logged on the Train screen — this row is status only. */
  it('offers no trigger for lifting', () => {
    render();
    expect(screen.queryByRole('button', { name: /Log Lifting/i })).not.toBeInTheDocument();
  });

  it('splits Pilates and Volleyball into their own rows', () => {
    render();
    fireEvent.click(screen.getByRole('button', { name: 'Log Pilates for today' }));

    const logged = useEntriesStore.getState().entries.filter(isActivity);
    expect(logged.map((e) => e.activity)).toEqual(['Pilates']);
    // Volleyball is untouched and still offered.
    expect(screen.getByRole('button', { name: 'Log Volleyball for today' })).toBeEnabled();
  });

  it('logs a warm-up completion', () => {
    render();
    fireEvent.click(screen.getByRole('button', { name: 'Log Warm-up for today' }));

    expect(useEntriesStore.getState().entries).toHaveLength(1);
    expect(useEntriesStore.getState().entries[0]).toMatchObject({ type: 'warmup', date: TODAY });
  });

  /**
   * toggleCompletion removes on a second call. A done row must not offer that
   * path — a stray tap silently deleting a logged session is the thing the
   * delete confirmations elsewhere exist to prevent.
   */
  it('disables a trigger once its item is done, so a second tap cannot un-log it', () => {
    render();
    fireEvent.click(screen.getByRole('button', { name: 'Log Core Finisher for today' }));

    const done = screen.getByRole('button', { name: 'Core Finisher already logged today' });
    expect(done).toBeDisabled();

    fireEvent.click(done);
    expect(useEntriesStore.getState().entries).toHaveLength(1);
  });
});
