/**
 * Progress → Achievements (legacy Achievements tab, renderAchievements —
 * legacy/index.html 3794–3822): "N / 25 unlocked" summary + responsive badge
 * grid. Unlocked state is computed live from the data (like legacy), not
 * from the seen list. Locked and unlocked badges differ by icon AND text —
 * never color alone.
 */
import { useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { Award, Lock } from 'lucide-react';
import { Card } from '@/components';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORY_LABEL,
  ACHIEVEMENT_METRIC_NOUN,
  ACHIEVEMENT_TIER_LABEL,
  achievementCategory,
  achievementProgress,
  achievementStatsSnapshot,
  achievementTier,
  toDisplayWeight,
  type AchievementCategory,
  type AchievementTier,
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
const TIER_TOKEN: Record<AchievementTier, 'tierBronze' | 'tierSilver' | 'tierGold' | 'tierPlatinum'> = {
  bronze: 'tierBronze',
  silver: 'tierSilver',
  gold: 'tierGold',
  platinum: 'tierPlatinum',
};

/**
 * Unlocked cards take their border from the tier; locked ones stay dashed and
 * neutral. The tier is a thing you earned, so an unearned card claiming a tier
 * colour would be saying you had it.
 */
const BadgeCard = styled.li<{ unlocked: boolean; tier: AchievementTier }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  text-align: center;
  background: ${({ theme, unlocked }) => (unlocked ? theme.colors.card : 'transparent')};
  border: ${({ unlocked }) => (unlocked ? '2px solid' : '1px dashed')}
    ${({ theme, unlocked, tier }) => (unlocked ? theme.colors[TIER_TOKEN[tier]] : theme.colors.border)};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => `${theme.space[3]} ${theme.space[2]}`};
`;

/** The tier spelled out, so the border colour is never the only signal. */
const TierWord = styled.span<{ tier: AchievementTier }>`
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${({ theme, tier }) => theme.colors[TIER_TOKEN[tier]]};
`;

const ChipRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  overflow-x: auto;
  padding-bottom: ${({ theme }) => theme.space[1]};
  /* Chips scroll sideways rather than wrapping into a second row at 375px. */
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const Chip = styled.button<{ active: boolean }>`
  flex: none;
  min-height: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => `${theme.space[1]} ${theme.space[3]}`};
  border-radius: ${({ theme }) => theme.radii.full};
  border: 1px solid ${({ theme, active }) => (active ? 'transparent' : theme.colors.border)};
  background: ${({ theme, active }) => (active ? theme.colors.primary : 'transparent')};
  color: ${({ theme, active }) => (active ? theme.colors.onPrimary : theme.colors.mutedForeground)};
  font-family: ${({ theme }) => theme.typography.body};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-weight: ${({ active }) => (active ? 700 : 500)};
  white-space: nowrap;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.ring};
    outline-offset: 2px;
  }
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


export function AchievementsTab() {
  const entries = useEntriesStore((s) => s.entries);
  const bwEntries = useBodyweightStore((s) => s.bwEntries);
  const measurements = useMeasurementsStore((s) => s.measurements);
  const unit = useSettingsStore((s) => s.unit);

  const snap = useMemo(
    () => achievementStatsSnapshot(entries, bwEntries, measurements),
    [entries, bwEntries, measurements],
  );
  const [filter, setFilter] = useState<AchievementCategory | 'all'>('all');

  // The hero counts EVERY achievement, not the filtered subset — a filter
  // narrows what you are looking at, it does not change how complete you are.
  const unlockedCount = ACHIEVEMENTS.filter((a) => a.check(snap)).length;
  const completionPct = Math.round((unlockedCount / ACHIEVEMENTS.length) * 100);

  const visible = useMemo(
    () => (filter === 'all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter((a) => achievementCategory(a) === filter)),
    [filter],
  );

  const categories = useMemo(() => {
    const present = new Set(ACHIEVEMENTS.map(achievementCategory));
    return (Object.keys(ACHIEVEMENT_CATEGORY_LABEL) as AchievementCategory[]).filter((c) => present.has(c));
  }, []);

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

      <ChipRow role="group" aria-label="Filter achievements">
        <Chip type="button" active={filter === 'all'} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </Chip>
        {categories.map((c) => (
          <Chip
            key={c}
            type="button"
            active={filter === c}
            aria-pressed={filter === c}
            onClick={() => setFilter(c)}
          >
            {ACHIEVEMENT_CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </ChipRow>

      <Grid aria-label="Achievements">
        {visible.map((a) => {
          const unlocked = a.check(snap);
          const tier = achievementTier(a);
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
            <BadgeCard key={a.id} unlocked={unlocked} tier={tier}>
              <BadgeIcon unlocked={unlocked}>
                <Icon size={22} aria-hidden="true" />
              </BadgeIcon>
              <BadgeLabel>{a.label}</BadgeLabel>
              <BadgeDesc>{a.desc}</BadgeDesc>
              {unlocked ? (
                <TierWord tier={tier}>{ACHIEVEMENT_TIER_LABEL[tier]}</TierWord>
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
