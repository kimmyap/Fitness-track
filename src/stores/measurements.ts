/** Body measurements store (gymlog:measurements). Inches; either field may be null. */
import { create } from 'zustand';
import { getMeasurements, saveMeasurements } from '@/lib/storage';
import { generateId, isoDate } from '@/lib/domain';
import type { MeasurementEntry } from '@/lib/types';

export interface MeasurementsState {
  measurements: MeasurementEntry[];
  setMeasurements: (entries: MeasurementEntry[]) => void;
  /** Log a measurement (inches, either may be null). Defaults to today. */
  addMeasurement: (waistInches: number | null, hipsInches: number | null, date?: string) => MeasurementEntry;
  deleteMeasurement: (id: string) => MeasurementEntry | undefined;
  restoreMeasurement: (entry: MeasurementEntry) => void;
}

export const useMeasurementsStore = create<MeasurementsState>((set, get) => {
  const persist = (measurements: MeasurementEntry[]) => {
    set({ measurements });
    void saveMeasurements(measurements);
  };

  return {
    measurements: getMeasurements(),
    setMeasurements: (entries) => persist(entries),
    addMeasurement: (waistInches, hipsInches, date) => {
      const entry: MeasurementEntry = { id: generateId(), date: date ?? isoDate(), waist: waistInches, hips: hipsInches };
      persist([...get().measurements, entry]);
      return entry;
    },
    deleteMeasurement: (id) => {
      const { measurements } = get();
      const removed = measurements.find((e) => e.id === id);
      if (!removed) return undefined;
      persist(measurements.filter((e) => e.id !== id));
      return removed;
    },
    restoreMeasurement: (entry) => persist([...get().measurements, entry]),
  };
});

/** Newest-first history (legacy shows last 10). */
export const selectMeasurementHistory = (s: MeasurementsState): MeasurementEntry[] =>
  [...s.measurements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
