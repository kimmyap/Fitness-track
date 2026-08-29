/**
 * Progress → Achievements (legacy Achievements tab, renderAchievements —
 * legacy/index.html 3794–3822): "N / 25 unlocked" summary + responsive badge
 * grid. Unlocked state is computed live from the data (like legacy), not
 * from the seen list. Locked and unlocked badges differ by icon AND text —
 * never color alone.
 */
import { useMemo } from 'react';
import styled from '@emotion/styled';
import { Award, Lock } from 'lucide-react';
import { Card } from '@/components';
import {
  ACHIEVEMENTS,
  achievementProgressHint,
  achievementStatsSnapshot,
} from '@/lib/domain';
import { ACHIEVEMENT_ICONS } from '@/lib/program';
import { useBodyweightStore, useEntriesStore, useMeasurementsStore, useSettingsStore } from '@/stores';

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
`;

const Summary = styled.p`
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.lg};
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`;

const Grid = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${({ theme }) => theme.space[2]};

  @media (min-width: 768px) {
    grid-template-columns: repeat(5, 1fr);
  }
`;

const BadgeCard = styled.li<{ unlocked: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  text-align: center;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme, unlocked }) => (unlocked ? theme.colors.primary : theme.colors.border)};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => `${theme.space[3]} ${theme.space[2]}`};
`;

const BadgeIcon = styled.span<{ unlocked: boolean }>`
  display: inline-flex;
  color: ${({ theme, unlocked }) => (unlocked ? theme.colors.primary : theme.colors.mutedForeground)};
`;

const BadgeLabel = styled.span`
  font-weight: 700;
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  color: ${({ theme }) => theme.colors.cardForeground};
`;

const BadgeDesc = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

const BadgeHint = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  font-weight: 500;
  color: ${({ theme }) => theme.colors.secondary};
`;

export function AchievementsTab() {
  const entries = useEntriesStore((s) => s.entries);
  const bwEntries = useBodyweightStore((s) => s.bwEntries);
  const measurements = useMeasurementsStore((s) => s.measurements);
  const unit = useSettingsStore((s) => s.unit);

  const snap = useMemo(
    () => achievementStatsSnapshot(entries, bwEntries, measurements),
    [entries, bwEntries, measurements],
  );
  const unlockedCount = ACHIEVEMENTS.filter((a) => a.check(snap)).length;

  return (
    <Stack>
      <Card>
        <Summary>
          <Award size={20} aria-hidden="true" />
          {unlockedCount} / {ACHIEVEMENTS.length} unlocked
        </Summary>
      </Card>

      <Grid aria-label="Achievements">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = a.check(snap);
          const Icon = unlocked ? (ACHIEVEMENT_ICONS[a.id] ?? Award) : Lock;
          const hint = unlocked ? '' : achievementProgressHint(a, snap, unit);
          return (
            <BadgeCard key={a.id} unlocked={unlocked}>
              <BadgeIcon unlocked={unlocked}>
                <Icon size={22} aria-hidden="true" />
              </BadgeIcon>
              <BadgeLabel>{a.label}</BadgeLabel>
              <BadgeDesc>{a.desc}</BadgeDesc>
              {unlocked ? (
                <BadgeHint>Unlocked</BadgeHint>
              ) : (
                <BadgeDesc>Locked{hint ? ` · ${hint}` : ''}</BadgeDesc>
              )}
            </BadgeCard>
          );
        })}
      </Grid>
    </Stack>
  );
}
