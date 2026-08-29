/** Custom goal weights (gymlog:goals): exercise name → goal lbs. */
import { create } from 'zustand';
import { getGoals, saveGoals } from '@/lib/storage';
import { goalFor as goalForPure } from '@/lib/domain';
import type { AnyExercise, GoalsMap } from '@/lib/types';

export interface GoalsState {
  goals: GoalsMap;
  setGoals: (goals: GoalsMap) => void;
  /** Set a goal weight in lbs. */
  setGoal: (exerciseName: string, goalLbs: number) => void;
  /** Remove the custom goal (falls back to the built-in default). */
  clearGoal: (exerciseName: string) => void;
}

export const useGoalsStore = create<GoalsState>((set, get) => {
  const persist = (goals: GoalsMap) => {
    set({ goals });
    void saveGoals(goals);
  };

  return {
    goals: getGoals(),
    setGoals: (goals) => persist(goals),
    setGoal: (exerciseName, goalLbs) => persist({ ...get().goals, [exerciseName]: goalLbs }),
    clearGoal: (exerciseName) => {
      const goals = { ...get().goals };
      delete goals[exerciseName];
      persist(goals);
    },
  };
});

/** Goal weight (lbs) for an exercise: custom goal overrides the built-in default. */
export const selectGoalFor =
  (ex: Pick<AnyExercise, 'name' | 'goal'>) =>
  (s: GoalsState): number =>
    goalForPure(ex, s.goals);
