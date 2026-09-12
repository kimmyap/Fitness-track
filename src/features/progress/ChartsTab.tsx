/**
 * Progress → Charts: exercise picker, est-1RM + top-set-weight line charts
 * (area fill 20%, range switcher, <4 points → stat card), weekly volume bar
 * chart (Mon-based weeks, current week highlighted with pattern + color,
 * direct value labels).
 */
import { useMemo, useState, type ReactNode } from 'react';
import styled from '@emotion/styled';
import { LineChart as LineChartIcon } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, EmptyState, Field, FieldLabel, InputBase, useReducedMotion } from '@/components';
import { displayDate, toDisplayWeight } from '@/lib/domain';
import type { Unit } from '@/lib/types';
import { useEntriesStore, useSettingsStore } from '@/stores';
import {
  CHART_RANGES,
  est1RMSeries,
  exercisesWithHistory,
  filterRange,
  formatCompact,
  topSetSeries,
  weeklyVolumeSeries,
  type ChartRange,
  type SeriesPoint,
} from './chartData';
import { ChartDataTable, ChartFrame, RangeSwitcher, useChartTokens } from './ChartKit';
import { MuscleVolumeSection } from './MuscleVolumeSection';

const VOLUME_WEEKS = 8;
/** Design-spec rule: fewer than 4 data points → stat card instead of a chart. */
const MIN_CHART_POINTS = 4;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
`;

const Select = InputBase.withComponent('select');

const SectionTitle = styled.h3`
  margin: 0 0 ${({ theme }) => theme.space[3]};
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.md};
  font-weight: 600;
`;

const StatValue = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.display};
  font-weight: 700;
  font-size: ${({ theme }) => theme.typography.fontSizes.xxl};
  font-variant-numeric: tabular-nums;
`;

const StatNote = styled.p`
  margin: ${({ theme }) => `${theme.space[1]} 0 0`};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

interface TrendSectionProps {
  title: string;
  metricLabel: string;
  exercise: string;
  points: SeriesPoint[];
  unit: Unit;
}

/** Est-1RM / top-set line chart with the <4-points stat-card fallback. */
function TrendSection({ title, metricLabel, exercise, points, unit }: TrendSectionProps) {
  const tokens = useChartTokens();
  const reduced = useReducedMotion();

  const data = points.map((p) => ({ label: displayDate(p.date), value: toDisplayWeight(p.value, unit) }));
  const table = {
    caption: `${title} for ${exercise}`,
    columns: ['Date', `${metricLabel} (${unit})`] as [string, string],
    rows: data.map((d) => [d.label, String(d.value)] as [string, string]),
  };

  if (points.length === 0) {
    return (
      <Card as="section">
        <SectionTitle>{title}</SectionTitle>
        <EmptyState
          icon={LineChartIcon}
          title="No data yet"
          description={`Log working sets for ${exercise} on the Train tab (or widen the range) and the trend will show up here.`}
        />
      </Card>
    );
  }

  if (points.length < MIN_CHART_POINTS) {
    const latest = data[data.length - 1];
    const remaining = MIN_CHART_POINTS - points.length;
    return (
      <Card as="section">
        <SectionTitle>{title}</SectionTitle>
        <StatValue>
          {latest?.value}
          {unit}
        </StatValue>
        <StatNote>
          Latest {metricLabel} ({latest?.label}). Log {remaining} more session
          {remaining !== 1 ? 's' : ''} to unlock the trend chart.
        </StatNote>
        <ChartDataTable {...table} />
      </Card>
    );
  }

  return (
    <Card>
      <ChartFrame title={title} table={table}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={tokens.grid.stroke} strokeOpacity={tokens.grid.strokeOpacity} />
            <XAxis dataKey="label" tick={tokens.tick} tickLine={false} axisLine={tokens.axisLine} minTickGap={24} />
            <YAxis
              tick={tokens.tick}
              width={42}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => formatCompact(v)}
            />
            <Tooltip
              contentStyle={tokens.tooltipContentStyle}
              labelStyle={tokens.tooltipLabelStyle}
              itemStyle={tokens.tooltipItemStyle}
              formatter={(value) => [`${String(value)}${unit}`, metricLabel]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={tokens.colors.primary}
              strokeWidth={2}
              fill={tokens.colors.primary}
              fillOpacity={0.2}
              dot={{ r: 2.5, fill: tokens.colors.primary, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              isAnimationActive={!reduced}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
    </Card>
  );
}

/** Weekly volume bars: past weeks muted, current week patterned + primary. */
function WeeklyVolumeSection({ unit }: { unit: Unit }) {
  const entries = useEntriesStore((s) => s.entries);
  const tokens = useChartTokens();
  const reduced = useReducedMotion();

  const weeks = useMemo(() => weeklyVolumeSeries(entries, VOLUME_WEEKS), [entries]);
  const data = weeks.map((w) => ({ ...w, volume: Math.round(toDisplayWeight(w.volume, unit)) }));
  const hasAny = data.some((w) => w.volume > 0);
  const table = {
    caption: `Weekly training volume, last ${VOLUME_WEEKS} weeks`,
    columns: ['Week starting', `Volume (${unit})`] as [string, string],
    rows: data.map((w) => [w.label, w.volume.toLocaleString()] as [string, string]),
  };

  if (!hasAny) {
    return (
      <Card as="section">
        <SectionTitle>Weekly volume</SectionTitle>
        <EmptyState
          icon={LineChartIcon}
          title="No data yet"
          description="Weekly volume (weight × sets × reps, Monday-based weeks) appears once you log weighted working sets."
        />
      </Card>
    );
  }

  return (
    <Card>
      <ChartFrame title={`Weekly volume (${unit})`} table={table}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {/* Pattern + color so the current week isn't marked by color alone. */}
              <pattern id="wk-current-pattern" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <rect width="6" height="6" fill={tokens.colors.primary} />
                <line x1="0" y1="0" x2="0" y2="6" stroke={tokens.colors.onPrimary} strokeWidth="2" strokeOpacity="0.4" />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} stroke={tokens.grid.stroke} strokeOpacity={tokens.grid.strokeOpacity} />
            <XAxis dataKey="label" tick={tokens.tick} tickLine={false} axisLine={tokens.axisLine} interval={0} />
            <YAxis
              tick={tokens.tick}
              width={42}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatCompact(v)}
            />
            <Tooltip
              cursor={{ fill: tokens.colors.muted, fillOpacity: 0.6 }}
              contentStyle={tokens.tooltipContentStyle}
              labelStyle={tokens.tooltipLabelStyle}
              itemStyle={tokens.tooltipItemStyle}
              labelFormatter={(label) => `Week of ${String(label)}`}
              formatter={(value) => [`${Number(value).toLocaleString()}${unit}`, 'Volume']}
            />
            <Bar dataKey="volume" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={!reduced}>
              {data.map((w) => (
                <Cell
                  key={w.weekStart}
                  fill={w.isCurrent ? 'url(#wk-current-pattern)' : tokens.colors.mutedForeground}
                  stroke={w.isCurrent ? tokens.colors.primary : 'none'}
                />
              ))}
              <LabelList
                dataKey="volume"
                position="top"
                fill={tokens.colors.mutedForeground}
                fontSize={10}
                formatter={(v: ReactNode) => formatCompact(Number(v))}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </Card>
  );
}

export function ChartsTab() {
  const entries = useEntriesStore((s) => s.entries);
  const unit = useSettingsStore((s) => s.unit);
  const exercises = useMemo(() => exercisesWithHistory(entries), [entries]);
  const [picked, setPicked] = useState<string | null>(null);
  const [range, setRange] = useState<ChartRange>('All');

  const exercise = picked && exercises.includes(picked) ? picked : (exercises[0] ?? null);

  const oneRm = useMemo(
    () => (exercise ? filterRange(est1RMSeries(entries, exercise), range) : []),
    [entries, exercise, range],
  );
  const topSet = useMemo(
    () => (exercise ? filterRange(topSetSeries(entries, exercise), range) : []),
    [entries, exercise, range],
  );

  if (!exercises.length) {
    return (
      <Stack>
        <Card>
          <EmptyState
            icon={LineChartIcon}
            title="No data yet"
            description="Log your first sets on the Train tab and your strength charts will build themselves."
          />
        </Card>
      </Stack>
    );
  }

  return (
    <Stack>
      <Field>
        <FieldLabel htmlFor="chart-exercise">Exercise</FieldLabel>
        <Select id="chart-exercise" value={exercise ?? ''} onChange={(e) => setPicked(e.target.value)}>
          {exercises.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </Field>

      <RangeSwitcher options={CHART_RANGES} value={range} onChange={setRange} aria-label="Chart time range" />

      {exercise ? (
        <>
          <TrendSection title={`Estimated 1RM (${unit})`} metricLabel="Est. 1RM" exercise={exercise} points={oneRm} unit={unit} />
          <TrendSection
            title={`Top set weight (${unit})`}
            metricLabel="Top set"
            exercise={exercise}
            points={topSet}
            unit={unit}
          />
        </>
      ) : null}

      <WeeklyVolumeSection unit={unit} />
      <MuscleVolumeSection unit={unit} />
    </Stack>
  );
}
