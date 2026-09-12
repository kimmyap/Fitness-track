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
  ACHIEVEMENT_METRIC_NOUN,
  achievementProgress,
  achievementStatsSnapshot,
  toDisplayWeight,
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

/**
 * Locked cards are dashed and unfilled; unlocked ones are solid and carry the
 * primary border. The distinction is deliberately in the BORDER and the icon,
 * never in the text opacity — dimming label text would drop it below the 4.5:1
 * the palette is held to. Icon + "Locked" wording still carry the meaning, so
 * none of it rests on colour.
 */
const BadgeCard = styled.li<{ unlocked: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  text-align: center;
  background: ${({ theme, unlocked }) => (unlocked ? theme.colors.card : 'transparent')};
  border: 1px ${({ unlocked }) => (unlocked ? 'solid' : 'dashed')}
    ${({ theme, unlocked }) => (unlocked ? theme.colors.primary : theme.colors.border)};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => `${theme.space[3]} ${theme.space[2]}`};
`;

const BadgeIcon = styled.span<{ unlocked: boolean }>`
  display: inline-flex;
  color: ${({ theme, unlocked }) => (unlocked ? theme.colors.primary : theme.colors.mutedForeground)};
`;

/** Thin fill bar. Decorative — the "39 / 60" beside it carries the value. */
const Track = styled.span`
  display: block;
  width: 100%;
  height: 4px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme }) => theme.colors.muted};
  overflow: hidden;
`;

const Fill = styled.span<{ pct: number; tone: 'primary' | 'accent' }>`
  display: block;
  height: 100%;
  width: ${({ pct }) => pct}%;
  border-radius: inherit;
  background: ${({ theme, tone }) => (tone === 'accent' ? theme.colors.accent : theme.colors.primary)};

  @media (prefers-reduced-motion: no-preference) {
    transition: width 240ms ease;
  }
`;

const HeroLine = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[2]};
  margin-top: ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  color: ${({ theme }) => theme.colors.mutedForeground};
  font-variant-numeric: tabular-nums;
`;

/** Counts inside a locked card, e.g. "39 / 60 sessions". */
const TrackLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.mutedForeground};
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
  const completionPct = Math.round((unlockedCount / ACHIEVEMENTS.length) * 100);

  return (
    <Stack>
      <Card>
        <Summary>
          <Award size={20} aria-hidden="true" />
          {unlockedCount} / {ACHIEVEMENTS.length} unlocked
        </Summary>
        <Track aria-hidden="true">
          <Fill pct={completionPct} tone="accent" />
        </Track>
        <HeroLine>
          <span>{completionPct}% complete</span>
          <span>{ACHIEVEMENTS.length - unlockedCount} to go</span>
        </HeroLine>
      </Card>

      <Grid aria-label="Achievements">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = a.check(snap);
          const Icon = unlocked ? (ACHIEVEMENT_ICONS[a.id] ?? Award) : Lock;
          const progress = achievementProgress(a, snap);
          // Volume thresholds are five figures — convert and abbreviate so the
          // count still fits a third of a 375px row.
          const asCount = (n: number) =>
            a.metric === 'totalVolume'
              ? Math.round(toDisplayWeight(n, unit)).toLocaleString()
              : n.toLocaleString();
          const noun = a.metric === 'totalVolume' ? unit : ACHIEVEMENT_METRIC_NOUN[a.metric];
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
                <>
                  <Track aria-hidden="true">
                    <Fill pct={progress.pct} tone="primary" />
                  </Track>
                  {/* The count IS the hint — the prose version said the same
                      thing again and wrapped to three lines in a 105px card. */}
                  <TrackLabel>
                    {asCount(progress.current)} / {asCount(progress.threshold)}
                    {noun ? ` ${noun}` : ''}
                  </TrackLabel>
                  <BadgeDesc>Locked</BadgeDesc>
                </>
              )}
            </BadgeCard>
          );
        })}
      </Grid>
    </Stack>
  );
}
