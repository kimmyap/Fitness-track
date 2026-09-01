import { describe, expect, it } from 'vitest';
import { filterExercises, humanizeEquipment, humanizePattern } from './ExercisePicker';
import type { LibraryExercise } from '@/services/exerciseLibraryService';

function ex(overrides: Partial<LibraryExercise>): LibraryExercise {
  return {
    id: 'x',
    name: 'Exercise',
    movement_pattern: 'ISOLATION',
    category: 'strength',
    level: 'beginner',
    primary_muscles: ['Chest'],
    secondary_muscles: [],
    equipment: 'BARBELL',
    execution_cues: ['Do the thing.'],
    default_setup: {
      supports_plate_calculator: true,
      bar_weight_lbs: 45,
      is_unilateral: false,
      default_rest_seconds: 120,
    },
    alternative_ids: [],
    images: [],
    ...overrides,
  };
}

const NO_FILTERS = { query: '', muscle: '', equipment: '', includeNonLifting: false };

describe('filterExercises', () => {
  const library = [
    ex({ id: 'bench', name: 'Barbell Bench Press', primary_muscles: ['Chest'], equipment: 'BARBELL' }),
    ex({ id: 'curl', name: 'Dumbbell Curl', primary_muscles: ['Biceps'], equipment: 'DUMBBELL' }),
    ex({ id: 'stretch', name: 'Chest Stretch', category: 'stretching', equipment: 'BODYWEIGHT' }),
    ex({ id: 'jog', name: 'Jogging', category: 'cardio', equipment: 'OTHER' }),
    ex({ id: 'clean', name: 'Power Clean', category: 'olympic weightlifting' }),
  ];

  it('hides stretching and cardio by default', () => {
    const names = filterExercises(library, NO_FILTERS).map((e) => e.id);
    expect(names).toEqual(['bench', 'curl', 'clean']);
  });

  it('includes them when asked', () => {
    const ids = filterExercises(library, { ...NO_FILTERS, includeNonLifting: true }).map((e) => e.id);
    expect(ids).toContain('stretch');
    expect(ids).toContain('jog');
  });

  it('keeps olympic and powerlifting in the lifting set', () => {
    expect(filterExercises(library, NO_FILTERS).map((e) => e.id)).toContain('clean');
  });

  it('searches by name, case-insensitively', () => {
    expect(filterExercises(library, { ...NO_FILTERS, query: 'bench' }).map((e) => e.id)).toEqual(['bench']);
    expect(filterExercises(library, { ...NO_FILTERS, query: 'CURL' }).map((e) => e.id)).toEqual(['curl']);
  });

  it('ignores surrounding whitespace in the query', () => {
    expect(filterExercises(library, { ...NO_FILTERS, query: '  curl  ' }).map((e) => e.id)).toEqual(['curl']);
  });

  it('filters by muscle and equipment', () => {
    expect(filterExercises(library, { ...NO_FILTERS, muscle: 'Biceps' }).map((e) => e.id)).toEqual(['curl']);
    expect(filterExercises(library, { ...NO_FILTERS, equipment: 'DUMBBELL' }).map((e) => e.id)).toEqual(['curl']);
  });

  it('combines filters conjunctively', () => {
    expect(
      filterExercises(library, { ...NO_FILTERS, muscle: 'Chest', equipment: 'DUMBBELL' }),
    ).toEqual([]);
  });
});

describe('label humanizers', () => {
  it('formats movement patterns', () => {
    expect(humanizePattern('HORIZONTAL_PUSH')).toBe('Horizontal push');
    expect(humanizePattern('HIP_HINGE')).toBe('Hip hinge');
  });

  it('formats equipment, special-casing the EZ curl bar', () => {
    expect(humanizeEquipment('BARBELL')).toBe('Barbell');
    expect(humanizeEquipment('EZ_CURL_BAR')).toBe('EZ curl bar');
    expect(humanizeEquipment('BODYWEIGHT')).toBe('Bodyweight');
  });
});
