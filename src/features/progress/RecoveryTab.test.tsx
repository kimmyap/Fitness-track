/**
 * The tab's job is to be HONEST about what it does not know, so that is what
 * most of this tests: an unmapped exercise has to be visible as unmapped, and
 * mapping it has to move the number.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithTheme } from '@/test/renderWithTheme';
import { useEntriesStore, useMuscleMapStore } from '@/stores';
import { getExerciseLibrary } from '@/services/exerciseLibraryService';
import type { Entry } from '@/lib/types';
import { RecoveryTab } from './RecoveryTab';

function todayIso(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let seq = 0;
function set(exercise: string, daysAgo = 1): Entry {
  return {
    id: `r${++seq}`,
    exercise,
    weight: 100,
    sets: 1,
    reps: 10,
    date: todayIso(daysAgo),
  } as Entry;
}

beforeEach(async () => {
  useEntriesStore.setState({ entries: [] });
  // Real field name — `useMuscleMapStore` stores it as `muscleMap`, and a typo
  // here would merge a junk key and read back {} while the assertion passed.
  useMuscleMapStore.setState({ muscleMap: {} });
  await getExerciseLibrary();
});

describe('RecoveryTab', () => {
  it('renders the rolling window and the benchmark it uses', async () => {
    useEntriesStore.setState({ entries: [set('Bench Press')] });
    renderWithTheme(<RecoveryTab />);

    // The heading interpolates the constant, so the text spans several nodes —
    // a role query normalizes across them, getByText does not.
    await waitFor(() => expect(screen.getByRole('heading', { name: /Last 7 days/i })).toBeInTheDocument());
    // Several ancestors contain this string, so match the document once rather
    // than asking getByText, which throws on multiple hits.
    expect(document.body.textContent).toMatch(/10-20 sets-per-week/);
  });

  it('separates "not in your program" from muscles that are merely behind', async () => {
    useEntriesStore.setState({ entries: [set('Bench Press')] });
    renderWithTheme(<RecoveryTab />);

    // Chest has one set: behind, but present.
    await waitFor(() => expect(screen.getByText('Under-worked', { exact: false })).toBeInTheDocument());
    // Nothing makes Neck a primary mover, and that must read differently.
    expect(screen.getByText('Not in your program', { exact: false })).toBeInTheDocument();
  });

  it('surfaces an unresolvable exercise instead of dropping its sets', async () => {
    useEntriesStore.setState({ entries: [set('Bulgarian Split Squat'), set('Bulgarian Split Squat')] });
    renderWithTheme(<RecoveryTab />);

    await waitFor(() => expect(screen.getByText(/2 sets are not counted/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/Bulgarian Split Squat/i)).toBeInTheDocument();
  });

  it('mapping an unmatched exercise moves its sets onto the chosen muscle', async () => {
    useEntriesStore.setState({ entries: [set('Bulgarian Split Squat')] });
    renderWithTheme(<RecoveryTab />);

    const select = await screen.findByLabelText(/Bulgarian Split Squat/i);
    fireEvent.change(select, { target: { value: 'Quadriceps' } });

    await waitFor(() => expect(useMuscleMapStore.getState().muscleMap).toEqual({ 'Bulgarian Split Squat': 'Quadriceps' }));
    // The warning is gone because nothing is unattributed any more.
    await waitFor(() => expect(screen.queryByText(/not counted/i)).not.toBeInTheDocument());
  });

  it('offers the suggestion drawer only when something is actually behind', async () => {
    useEntriesStore.setState({ entries: [set('Bench Press')] });
    renderWithTheme(<RecoveryTab />);

    const open = await screen.findByRole('button', { name: /Find exercises for what is behind/i });
    fireEvent.click(open);

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByText(/Train what is behind/i)).toBeInTheDocument();
  });

  /**
   * The drawer is only useful if it suggests things you can do. With a barbell
   * history it must not lead with machine and band movements.
   */
  it('leads its suggestions with equipment the history shows you use', async () => {
    useEntriesStore.setState({ entries: [set('Bench Press'), set('Deadlifts')] });
    renderWithTheme(<RecoveryTab />);

    fireEvent.click(await screen.findByRole('button', { name: /Find exercises for what is behind/i }));
    const dialog = await screen.findByRole('dialog');

    // Barbell is what this history uses, so it has to appear among the picks.
    await waitFor(() => expect(dialog.textContent).toMatch(/Barbell/));
  });

  it('says so when the library cannot be loaded, rather than showing zeroes', async () => {
    const mod = await import('@/services/exerciseLibraryService');
    const spy = vi.spyOn(mod, 'getExerciseLibrary').mockRejectedValueOnce(new Error('offline'));

    renderWithTheme(<RecoveryTab />);
    await waitFor(() => expect(screen.getByText(/unavailable offline/i)).toBeInTheDocument());
    // Crucially it must NOT claim every muscle is untrained.
    expect(screen.queryByText('Not in your program', { exact: false })).not.toBeInTheDocument();
    spy.mockRestore();
  });
});
