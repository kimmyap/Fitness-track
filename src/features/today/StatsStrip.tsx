/**
 * Stats strip (Today + workout tabs): streak with fire-tier icon/label + glow,
 * sessions this month, all-time sessions.
 */
import styled from '@emotion/styled';
import { StatStrip, StatTile } from '@/components';
import { useEntriesStore } from '@/stores';
import { computeStats, fireTier } from '@/lib/domain';
import type { FireTierLevel } from '@/lib/domain';
import { FIRE_TIER_ICONS } from '@/lib/program';

const tierColorKey: Record<FireTierLevel, 'accent' | 'primary' | 'secondary'> = {
  seedling: 'accent',
  building: 'secondary',
  heating: 'primary',
  fire: 'primary',
  crown: 'secondary',
};

const TierIconWrap = styled.span<{ level: FireTierLevel }>`
  display: inline-flex;
  color: ${({ theme, level }) => theme.colors[tierColorKey[level]]};
`;

export function TodayStatsStrip() {
  // Subscribe to the raw entries array (stable ref) and derive during render —
  // zustand v5 selectors must not return fresh objects.
  const entries = useEntriesStore((s) => s.entries);
  const stats = computeStats(entries);
  const fire = fireTier(stats.streak);
  const Icon = FIRE_TIER_ICONS[fire.level];
  return (
    <StatStrip>
      <StatTile
        label="Streak"
        value={stats.streak}
        sub={fire.label}
        glow={fire.glow}
        icon={
          <TierIconWrap level={fire.level}>
            <Icon size={20} />
          </TierIconWrap>
        }
      />
      <StatTile label="This Month" value={stats.thisMonthCount} />
      <StatTile label="All Time" value={stats.totalWorkouts} />
    </StatStrip>
  );
}
