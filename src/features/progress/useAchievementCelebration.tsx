/**
 * Legacy checkAchievements() celebration: after a data mutation, newly
 * unlocked achievements fire confetti + an "Achievement unlocked" toast with
 * a random hype line (legacy/index.html line 1680).
 */
import { useCallback, useState, type ReactNode } from 'react';
import { Confetti, toast } from '@/components';
import { randomHype } from '@/lib/program';
import { useAchievementsStore } from '@/stores';

export function useAchievementCelebration(): { celebrate: () => void; confetti: ReactNode } {
  const [burst, setBurst] = useState(false);
  const checkAchievements = useAchievementsStore((s) => s.checkAchievements);

  const celebrate = useCallback(() => {
    const newly = checkAchievements();
    if (!newly.length) return;
    newly.forEach((a) => toast(`Achievement unlocked: ${a.label} — ${randomHype()}`));
    setBurst(true);
  }, [checkAchievements]);

  const confetti = <Confetti active={burst} onDone={() => setBurst(false)} />;
  return { celebrate, confetti };
}
