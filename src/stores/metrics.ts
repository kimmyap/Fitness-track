/**
 * Daily wellness metrics (gymlog:dailyMetrics) and cardio (gymlog:cardio).
 * Write-through on every mutation, like the other stores here.
 *
 * Body weight is NOT in this store. It lives in gymlog:bodyweight and the
 * metrics form writes there through useBodyweightStore, so the Body chart
 * stays the one source of truth for that number.
 */
import { create } from 'zustand';
import {
  getCardioSessions,
  getDailyMetrics,
  saveCardioSessions,
  saveDailyMetrics,
} from '@/lib/storage';
import { generateId, isoDate } from '@/lib/domain';
import { dateWindow, parseIsoDate } from '@/lib/dates';
import type { CardioSession, DailyMetric, DailyMetricsMap } from '@/lib/types';

export interface MetricsState {
  dailyMetrics: DailyMetricsMap;
  cardio: CardioSession[];
  /**
   * Merge fields into one day. A field passed as `undefined` is DELETED rather
   * than stored — optional fields are absent, not null (see lib/types.ts), and
   * clearing an input has to be able to unset the value.
   */
  setDayMetrics: (date: string, patch: DailyMetric) => void;
  /** Bulk replace — used by backup import. */
  setDailyMetrics: (map: DailyMetricsMap) => void;
  setCardio: (sessions: CardioSession[]) => void;
  addCardio: (session: Omit<CardioSession, 'id'>) => CardioSession;
  /** Remove a session; returns it for the Undo toast. */
  deleteCardio: (id: string) => CardioSession | undefined;
  restoreCardio: (session: CardioSession) => void;
}

/** Drop keys whose value is undefined, so they are absent in storage. */
function pruned(metric: DailyMetric): DailyMetric {
  const out: DailyMetric = {};
  if (metric.calories !== undefined) out.calories = metric.calories;
  if (metric.protein !== undefined) out.protein = metric.protein;
  if (metric.sleepHours !== undefined) out.sleepHours = metric.sleepHours;
  if (metric.energy !== undefined) out.energy = metric.energy;
  return out;
}

export const useMetricsStore = create<MetricsState>((set, get) => {
  const persistMetrics = (dailyMetrics: DailyMetricsMap) => {
    set({ dailyMetrics });
    void saveDailyMetrics(dailyMetrics);
  };
  const persistCardio = (cardio: CardioSession[]) => {
    set({ cardio });
    void saveCardioSessions(cardio);
  };

  return {
    dailyMetrics: getDailyMetrics(),
    cardio: getCardioSessions(),

    setDailyMetrics: (map) => persistMetrics(map),
    setCardio: (sessions) => persistCardio(sessions),

    setDayMetrics: (date, patch) => {
      const next = { ...get().dailyMetrics };
      const merged = pruned({ ...next[date], ...patch });
      // A day with every field cleared drops out entirely rather than
      // leaving an empty object behind.
      if (Object.keys(merged).length === 0) delete next[date];
      else next[date] = merged;
      persistMetrics(next);
    },

    addCardio: (session) => {
      const created: CardioSession = { ...session, id: generateId() };
      persistCardio([...get().cardio, created]);
      return created;
    },

    deleteCardio: (id) => {
      const { cardio } = get();
      const removed = cardio.find((c) => c.id === id);
      if (!removed) return undefined;
      persistCardio(cardio.filter((c) => c.id !== id));
      return removed;
    },

    restoreCardio: (session) => persistCardio([...get().cardio, session]),
  };
});

/** That day's metrics, or an empty record — callers never handle undefined. */
export const metricsForDate = (s: MetricsState, date: string): DailyMetric => s.dailyMetrics[date] ?? {};

/** Sessions for one day, newest first. */
export function cardioForDate(sessions: CardioSession[], date: string): CardioSession[] {
  return sessions.filter((c) => c.date === date);
}

/** Total minutes logged in the last `days` days, ending today. */
export function cardioMinutesInLastDays(sessions: CardioSession[], days: number, today = isoDate()): number {
  /*
   * `new Date(today)` was UTC midnight while `isoDate` reformats in LOCAL, so
   * west of Greenwich the window came out a day too wide — a "last 7 days"
   * total that quietly covered eight.
   */
  const from = dateWindow(parseIsoDate(today) ?? new Date(), days)[0] ?? today;
  return sessions.filter((c) => c.date >= from && c.date <= today).reduce((sum, c) => sum + c.minutes, 0);
}
