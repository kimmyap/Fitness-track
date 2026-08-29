/**
 * Shared celebration helpers for the Today + Train features.
 *
 * Legacy behavior: newly unlocked achievements fire confetti + a toast,
 * delayed 3.2s (staggered 5.2s apart) so PR/log toasts show first.
 */
import { useCallback, useState } from 'react';
import { toast } from '@/components';
import { randomHype } from '@/lib/program';
import type { AchievementDef } from '@/lib/domain';

export interface ConfettiControl {
  active: boolean;
  fire: () => void;
  done: () => void;
}

/** Page-level confetti state: `fire()` to burst, pass `active`/`done` to <Confetti />. */
export function useConfetti(): ConfettiControl {
  const [active, setActive] = useState(false);
  const fire = useCallback(() => setActive(true), []);
  const done = useCallback(() => setActive(false), []);
  return { active, fire, done };
}

/** Legacy delays: 3200ms before the first achievement toast, 5200ms between. */
export const ACHIEVEMENT_TOAST_BASE_DELAY_MS = 3200;
export const ACHIEVEMENT_TOAST_STAGGER_MS = 5200;

/**
 * Fire confetti + a hype toast for each newly unlocked achievement
 * (pass the result of useAchievementsStore.getState().checkAchievements()).
 */
export function celebrateAchievements(newlyUnlocked: AchievementDef[], fireConfetti?: () => void): void {
  newlyUnlocked.forEach((a, i) => {
    setTimeout(
      () => {
        fireConfetti?.();
        toast(`Achievement unlocked: ${a.label} — ${randomHype()}`);
      },
      ACHIEVEMENT_TOAST_BASE_DELAY_MS + i * ACHIEVEMENT_TOAST_STAGGER_MS,
    );
  });
}
