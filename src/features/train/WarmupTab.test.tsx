import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithTheme } from '@/test/renderWithTheme';
import { useEntriesStore } from '@/stores';
import { WarmupTab } from './WarmupTab';

/** 2026-09-15 is a Tuesday — DAY_PLAN says Lower A. */
const TUESDAY = new Date('2026-09-15T09:00:00');
/** 2026-09-14 is a Monday — Pilates day, no lifting tab. */
const MONDAY = new Date('2026-09-14T09:00:00');

/** Every tickable movement row, in DOM order — they are the only aria-pressed buttons here. */
const movementButtons = () => screen.queryAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'));

/** The movement NAME out of each row, without its rep detail or the SR-only state. */
const movementNames = () => movementButtons().map((b) => b.querySelector('span')?.textContent ?? '');

const progress = () => screen.getByText(/ticked off/).textContent ?? '';

beforeEach(() => {
  useEntriesStore.setState({ entries: [] });
  vi.useFakeTimers();
  vi.setSystemTime(TUESDAY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('WarmupTab', () => {
  /** The old tab showed all three routines at once and left you to filter. */
  it("shows only the block that preps today's session", () => {
    renderWithTheme(<WarmupTab />);

    expect(screen.getByText('Lower body prep')).toBeInTheDocument();
    expect(screen.queryByText('Upper body prep')).not.toBeInTheDocument();
    expect(screen.getByText(/today is Lower A/)).toBeInTheDocument();
    // Cardio is always drawn, whatever the focus.
    expect(screen.getByText('Raise the temperature')).toBeInTheDocument();
  });

  it('gives a non-lifting day the full-body block', () => {
    vi.setSystemTime(MONDAY);
    renderWithTheme(<WarmupTab />);

    expect(screen.getByText('Full body prep')).toBeInTheDocument();
    expect(screen.queryByText('Lower body prep')).not.toBeInTheDocument();
    expect(screen.getByText(/today is Pilates Day/)).toBeInTheDocument();
  });

  it('keeps the other routines reachable rather than hidden', () => {
    renderWithTheme(<WarmupTab />);

    const disclosure = screen.getByText('Other routines');
    expect(disclosure).toBeInTheDocument();
    // Both non-selected blocks are listed inside it.
    expect(screen.getByText('Upper body')).toBeInTheDocument();
    expect(screen.getByText('Full body')).toBeInTheDocument();
  });

  it('counts movements off as you tick them', () => {
    renderWithTheme(<WarmupTab />);
    expect(progress()).toBe('0 of 7 ticked off');

    const first = movementButtons()[0] as HTMLElement;
    fireEvent.click(first);

    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(progress()).toBe('1 of 7 ticked off');
  });

  it('says to log it once everything is ticked', () => {
    renderWithTheme(<WarmupTab />);
    for (const button of movementButtons()) fireEvent.click(button);

    expect(screen.getByText('7 of 7 ticked off — log it')).toBeInTheDocument();
  });

  /**
   * The point of the subset property in warmupPlan: lengthening the warm-up
   * must not reshuffle the movements you already worked through.
   */
  it('adds movements on Quick → Full without dropping a tick', () => {
    renderWithTheme(<WarmupTab />);

    fireEvent.click(screen.getByRole('tab', { name: /Quick/ }));
    expect(progress()).toBe('0 of 5 ticked off');

    const quickNames = movementNames();
    for (const button of movementButtons()) fireEvent.click(button);
    expect(progress()).toBe('5 of 5 ticked off — log it');

    fireEvent.click(screen.getByRole('tab', { name: /Full/ }));

    expect(progress()).toBe('5 of 7 ticked off');
    expect(movementNames()).toEqual(expect.arrayContaining(quickNames));
  });

  /** A new draw means the old ticks describe movements you are no longer doing. */
  it('clears ticks and redraws on Shuffle', () => {
    renderWithTheme(<WarmupTab />);
    const before = movementNames();

    fireEvent.click(movementButtons()[0] as HTMLElement);
    expect(progress()).toBe('1 of 7 ticked off');

    fireEvent.click(screen.getByRole('button', { name: /Shuffle/ }));

    expect(progress()).toBe('0 of 7 ticked off');
    expect(movementNames()).not.toEqual(before);
  });

  /** Ticks are scratch state; the completion entry is what counts as history. */
  it('logs completion in the unchanged legacy entry shape', () => {
    renderWithTheme(<WarmupTab />);

    fireEvent.click(screen.getByRole('button', { name: /Mark Warm-up Complete/ }));

    const entries = useEntriesStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ type: 'warmup', date: '2026-09-15' });
    expect(screen.getByText('Marked complete')).toBeInTheDocument();
  });
});

/**
 * Ticks survive a reload via `gymlog:warmupProgress`. The nonce is the part
 * worth testing: restoring ticks against a plan drawn with a different shuffle
 * count would check off movements the user never touched.
 */
describe('WarmupTab persistence', () => {
  it('restores ticks after a remount', () => {
    const first = renderWithTheme(<WarmupTab />);
    fireEvent.click(movementButtons()[0] as HTMLElement);
    const tickedName = movementNames()[0];
    expect(progress()).toBe('1 of 7 ticked off');
    first.unmount();

    renderWithTheme(<WarmupTab />);
    expect(progress()).toBe('1 of 7 ticked off');
    expect(movementButtons()[0]).toHaveAttribute('aria-pressed', 'true');
    expect(movementNames()[0]).toBe(tickedName);
  });

  it('restores the shuffled plan, not the day-zero draw', () => {
    const first = renderWithTheme(<WarmupTab />);
    fireEvent.click(screen.getByRole('button', { name: /Shuffle/ }));
    fireEvent.click(screen.getByRole('button', { name: /Shuffle/ }));
    const shuffledNames = movementNames();
    fireEvent.click(movementButtons()[0] as HTMLElement);
    first.unmount();

    renderWithTheme(<WarmupTab />);
    expect(movementNames()).toEqual(shuffledNames);
    expect(progress()).toBe('1 of 7 ticked off');
  });

  /**
   * A past day's ticks name movements that are no longer on screen.
   *
   * The later date is another TUESDAY on purpose: same focus block, so the only
   * thing that can clear the ticks is the stored date failing to match. A
   * different weekday would pass even if the date check were deleted.
   */
  it('ignores progress stored on another day', () => {
    const first = renderWithTheme(<WarmupTab />);
    fireEvent.click(movementButtons()[0] as HTMLElement);
    first.unmount();

    vi.setSystemTime(new Date('2026-09-22T09:00:00'));
    renderWithTheme(<WarmupTab />);
    expect(screen.getByText('Lower body prep')).toBeInTheDocument();
    expect(progress()).toBe('0 of 7 ticked off');
  });

  it('clears stored ticks when you shuffle', () => {
    const first = renderWithTheme(<WarmupTab />);
    fireEvent.click(movementButtons()[0] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: /Shuffle/ }));
    first.unmount();

    renderWithTheme(<WarmupTab />);
    expect(progress()).toBe('0 of 7 ticked off');
  });
});
