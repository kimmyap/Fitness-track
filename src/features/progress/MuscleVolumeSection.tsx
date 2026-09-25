/**
 * Volume per muscle group.
 *
 * The muscle data lives in the 1.2 MB exercise library, which CLAUDE.md and
 * HANDOFF §5 both require to stay a lazy chunk. So this section imports nothing
 * from it at module scope: it calls `getExerciseLibrary()` on mount, which is
 * the same dynamic import the exercise picker uses. Opening Progress costs
 * nothing until this card is actually rendered.
 */
import { useMemo } from 'react';
import styled from '@emotion/styled';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle } from 'lucide-react';
import { Card, EmptyState, useReducedMotion } from '@/components';
import { toDisplayWeight } from '@/lib/domain';
import type { Unit } from '@/lib/types';
import { useEntriesStore } from '@/stores';
import { useExerciseLibrary } from '@/services/useExerciseLibrary';
import { muscleVolumeSummary, formatCompact, toMuscleLookup } from './chartData';
import { ChartFrame, useChartTokens } from './ChartKit';

const SectionTitle = styled.h2`
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.md};
  margin: 0 0 ${({ theme }) => theme.space[2]};
`;

const Note = styled.p`
  margin: ${({ theme }) => theme.space[2]} 0 0;
  color: ${({ theme }) => theme.colors.mutedForeground};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
`;

/** Longest bars first, but not so many that the card becomes a wall. */
const MAX_MUSCLES = 8;

export function MuscleVolumeSection({ unit }: { unit: Unit }) {
  const entries = useEntriesStore((s) => s.entries);
  const tokens = useChartTokens();
  const reduced = useReducedMotion();
  const { status } = useExerciseLibrary();
  const ready = status === 'ready';

  const rows = useMemo(
    () => (ready ? muscleVolumeSummary(entries, toMuscleLookup()).slice(0, MAX_MUSCLES) : []),
    [entries, ready],
  );

  if (!ready || !rows.length) {
    /*
     * Three states, not two. A failed load used to fall back to `ready = false`
     * and render as "Loading exercise data…" forever, because the absence of
     * success was being read as "still in progress".
     */
    const empty =
      status === 'failed'
        ? {
            icon: AlertTriangle,
            title: 'Muscle data unavailable offline',
            description:
              'The exercise library has not been cached on this device yet. Open this card once while online and it will work offline afterwards.',
          }
        : status === 'ready'
          ? {
              icon: Activity,
              title: 'No data yet',
              description:
                'Volume per muscle appears once you log working sets for exercises in the library.',
            }
          : {
              icon: Activity,
              title: 'Loading exercise data…',
              description:
                'The muscle map loads on demand, so it only downloads when you open this card.',
            };
    return (
      <Card as="section">
        <SectionTitle>Muscle volume</SectionTitle>
        <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />
      </Card>
    );
  }

  const data = rows.map((r) => ({
    muscle: r.muscle,
    volume: Math.round(toDisplayWeight(r.volume, unit)),
    sets: r.workingSets,
  }));

  const table = {
    caption: 'Volume per muscle group, all time',
    columns: ['Muscle', `Volume (${unit})`, 'Working sets'] as const,
    rows: data.map((d) => [d.muscle, d.volume.toLocaleString(), String(d.sets)] as const),
  };

  return (
    <Card as="section">
      <SectionTitle>Muscle volume</SectionTitle>
      <ChartFrame title={`Volume per muscle (${unit})`} height={Math.max(200, data.length * 34)} table={table}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, left: 0, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke={tokens.grid.stroke} strokeOpacity={tokens.grid.strokeOpacity} />
            <XAxis type="number" tick={tokens.tick} tickLine={false} axisLine={false} tickFormatter={formatCompact} />
            <YAxis type="category" dataKey="muscle" tick={tokens.tick} width={92} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={tokens.tooltipContentStyle}
              labelStyle={tokens.tooltipLabelStyle}
              itemStyle={tokens.tooltipItemStyle}
              cursor={{ fill: tokens.grid.stroke, fillOpacity: 0.15 }}
              formatter={(value, _n, item) => [
                `${Number(value).toLocaleString()}${unit} · ${String(
                  (item?.payload as { sets?: number } | undefined)?.sets ?? 0,
                )} working sets`,
                'Volume',
              ]}
            />
            <Bar dataKey="volume" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={!reduced}>
              {data.map((d) => (
                <Cell key={d.muscle} fill={tokens.colors.primary} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <Note>
        Secondary muscles count at half volume. Working sets count only where the muscle is the primary mover.
      </Note>
    </Card>
  );
}
