import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithTheme } from '@/test/renderWithTheme';
import { useBodyweightStore, useMetricsStore } from '@/stores';
import { STORAGE_KEYS, fullKey, getCardioSessions, getDailyMetrics } from '@/lib/storage';
import { MetricsTab } from './MetricsTab';

const TODAY = new Date().toISOString().slice(0, 10);

beforeEach(() => {
  localStorage.clear();
  useMetricsStore.setState({ dailyMetrics: {}, cardio: [] });
  useBodyweightStore.setState({ bwEntries: [] });
});

const num = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;

describe('daily metrics storage', () => {
  it('keeps optional fields absent rather than null', () => {
    useMetricsStore.getState().setDayMetrics(TODAY, { calories: 2100 });

    const stored = JSON.parse(localStorage.getItem(fullKey(STORAGE_KEYS.dailyMetrics)) ?? '{}');
    expect(stored[TODAY]).toEqual({ calories: 2100 });
    expect('protein' in stored[TODAY]).toBe(false);
  });

  it('clearing the last field drops the day entirely', () => {
    const { setDayMetrics } = useMetricsStore.getState();
    setDayMetrics(TODAY, { calories: 2100 });
    setDayMetrics(TODAY, { calories: undefined });

    expect(useMetricsStore.getState().dailyMetrics[TODAY]).toBeUndefined();
  });

  it('merges fields into an existing day instead of replacing it', () => {
    const { setDayMetrics } = useMetricsStore.getState();
    setDayMetrics(TODAY, { calories: 2100 });
    setDayMetrics(TODAY, { protein: 150 });

    expect(useMetricsStore.getState().dailyMetrics[TODAY]).toEqual({ calories: 2100, protein: 150 });
  });

  /** One malformed day must not discard the rest — the rule from schemas.ts. */
  it('drops only the malformed day on read', () => {
    localStorage.setItem(
      fullKey(STORAGE_KEYS.dailyMetrics),
      JSON.stringify({ [TODAY]: { calories: 2100 }, 'not-a-date': { calories: 1 } }),
    );

    const read = getDailyMetrics();
    expect(read[TODAY]).toEqual({ calories: 2100 });
  });
});

describe('cardio storage', () => {
  it('omits distance when it was not measured', () => {
    useMetricsStore.getState().addCardio({ date: TODAY, type: 'jog', minutes: 30 });

    const [row] = getCardioSessions();
    expect(row?.minutes).toBe(30);
    expect(row && 'miles' in row).toBe(false);
  });

  it('backfills a missing id on read without rewriting storage', () => {
    const raw = JSON.stringify([{ date: TODAY, type: 'treadmill', minutes: 20 }]);
    localStorage.setItem(fullKey(STORAGE_KEYS.cardio), raw);

    expect(getCardioSessions()[0]?.id).toBeTruthy();
    expect(localStorage.getItem(fullKey(STORAGE_KEYS.cardio))).toBe(raw);
  });
});

describe('MetricsTab', () => {
  it('writes body weight to the bodyweight key, not the metrics key', () => {
    renderWithTheme(<MetricsTab />);

    const weight = num(/body weight/i);
    fireEvent.change(weight, { target: { value: '131' } });
    fireEvent.blur(weight);

    expect(useBodyweightStore.getState().bwEntries).toHaveLength(1);
    expect(useBodyweightStore.getState().bwEntries[0]?.weight).toBe(131);
    expect(useMetricsStore.getState().dailyMetrics[TODAY]).toBeUndefined();
  });

  it('re-saving the same day updates the weigh-in instead of stacking rows', () => {
    renderWithTheme(<MetricsTab />);
    const weight = num(/body weight/i);

    fireEvent.change(weight, { target: { value: '131' } });
    fireEvent.blur(weight);
    fireEvent.change(weight, { target: { value: '132' } });
    fireEvent.blur(weight);

    const rows = useBodyweightStore.getState().bwEntries;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.weight).toBe(132);
  });

  it('saves metrics on blur', () => {
    renderWithTheme(<MetricsTab />);

    const calories = num(/calories/i);
    fireEvent.change(calories, { target: { value: '2100' } });
    expect(useMetricsStore.getState().dailyMetrics[TODAY]).toBeUndefined();

    fireEvent.blur(calories);
    expect(useMetricsStore.getState().dailyMetrics[TODAY]).toEqual({ calories: 2100 });
  });

  it('logs a cardio session and clears the inputs', () => {
    renderWithTheme(<MetricsTab />);

    fireEvent.change(num(/duration/i), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /log cardio/i }));

    const { cardio } = useMetricsStore.getState();
    expect(cardio).toHaveLength(1);
    expect(cardio[0]).toMatchObject({ type: 'jog', minutes: 30, date: TODAY });
    expect(num(/duration/i).value).toBe('');
  });

  /** Volleyball and Pilates live in gymlog:entries — offering them here would double-count. */
  it('offers only jog, treadmill and other as cardio types', () => {
    renderWithTheme(<MetricsTab />);
    const group = screen.getByRole('group', { name: 'Type' });

    expect(group.textContent).toBe('JogTreadmillOther');
  });

  it('deleting a session needs a confirm tap', () => {
    renderWithTheme(<MetricsTab />);
    fireEvent.change(num(/duration/i), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /log cardio/i }));

    fireEvent.click(screen.getByRole('button', { name: /^Delete Jog session/i }));
    expect(useMetricsStore.getState().cardio).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /^Confirm delete of Jog session/i }));
    expect(useMetricsStore.getState().cardio).toHaveLength(0);
  });
});
