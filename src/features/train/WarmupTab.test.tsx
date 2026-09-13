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

  /** Ticks are a scratchpad; the completion entry is the only thing stored. */
  it('logs completion in the unchanged legacy entry shape', () => {
    renderWithTheme(<WarmupTab />);

    fireEvent.click(screen.getByRole('button', { name: /Mark Warm-up Complete/ }));

    const entries = useEntriesStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ type: 'warmup', date: '2026-09-15' });
    expect(screen.getByText('Marked complete')).toBeInTheDocument();
  });
});
