/**
 * Progress → Body (legacy Weight tab, renderWeight — legacy/index.html
 * 3501–3620): bodyweight stats strip / log form / trend chart / last-10
 * history with delete+undo, then waist/hips measurements with the same
 * pattern. Weights stored in lbs, measurements in inches; kg/cm display-only.
 */
import { useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { Ruler, Scale, X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  NumberInput,
  StatStrip,
  StatTile,
  toast,
  useReducedMotion,
} from '@/components';
import {
  BODYWEIGHT_GOAL_LBS,
  displayDate,
  fmtNum,
  fromDisplayLength,
  fromDisplayWeight,
  toDisplayLength,
  toDisplayWeight,
} from '@/lib/domain';
import { useBodyweightStore, useMeasurementsStore, useSettingsStore } from '@/stores';
import { bodyweightSeries, movingAverageSeries } from './chartData';
import { ChartFrame, useChartTokens } from './ChartKit';
import { useAchievementCelebration } from './useAchievementCelebration';

const MIN_CHART_POINTS = 4;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
`;

const SectionHeading = styled.h3`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.lg};
  font-weight: 600;
`;

const CardTitle = styled.h4`
  margin: 0 0 ${({ theme }) => theme.space[2]};
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.md};
  font-weight: 600;
`;

const CardHint = styled.p`
  margin: ${({ theme }) => `0 0 ${theme.space[2]}`};
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

const FormRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  align-items: flex-end;

  > :first-of-type {
    flex: 1;
  }
`;

const TwoFieldRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  align-items: flex-end;

  > * {
    flex: 1;
  }

  > button {
    flex: 0 0 auto;
  }
`;

const HistoryRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => `${theme.space[1]} 0`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};

  &:last-of-type {
    border-bottom: none;
  }
`;

const HistoryDate = styled.span`
  flex: 1;
  color: ${({ theme }) => theme.colors.mutedForeground};
  font-variant-numeric: tabular-nums;
`;

const HistoryValue = styled.span`
  font-weight: 500;
  font-variant-numeric: tabular-nums;
`;

// ---------------------------------------------------------------------------
// Bodyweight
// ---------------------------------------------------------------------------

function BodyweightSection({ celebrate }: { celebrate: () => void }) {
  const unit = useSettingsStore((s) => s.unit);
  const bwEntries = useBodyweightStore((s) => s.bwEntries);
  const addWeighIn = useBodyweightStore((s) => s.addWeighIn);
  const deleteWeighIn = useBodyweightStore((s) => s.deleteWeighIn);
  const restoreWeighIn = useBodyweightStore((s) => s.restoreWeighIn);
  // NOTE: stores' selectBwHistory returns a fresh array per call, which loops
  // under zustand v5 useSyncExternalStore — select the raw array and memoize.
  const history = useMemo(
    () => [...bwEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [bwEntries],
  );
  const tokens = useChartTokens();
  const reduced = useReducedMotion();

  const latest = history[0];
  const first = history[history.length - 1];
  const [input, setInput] = useState(() => (latest ? String(toDisplayWeight(latest.weight, unit)) : ''));

  const series = useMemo(() => bodyweightSeries(bwEntries), [bwEntries]);
  /*
   * Daily weight swings several lbs on water alone, which buries the actual
   * trend. The 7-day trailing mean is the line worth reading; raw readings stay
   * as dots so nothing is hidden.
   */
  const smoothed = useMemo(() => movingAverageSeries(series, 7), [series]);
  const data = series.map((p, i) => ({
    label: displayDate(p.date),
    value: toDisplayWeight(p.value, unit),
    trend: toDisplayWeight(smoothed[i]?.value ?? p.value, unit),
  }));
  const goalDisplay = toDisplayWeight(BODYWEIGHT_GOAL_LBS, unit);
  const table = {
    caption: 'Bodyweight over time, with its 7-day average',
    columns: ['Date', `Weight (${unit})`, `7-day avg (${unit})`] as [string, string, string],
    rows: data.map((d) => [d.label, String(d.value), String(d.trend)] as [string, string, string]),
  };

  const log = () => {
    const v = parseFloat(input);
    if (!v) return;
    addWeighIn(fromDisplayWeight(v, unit));
    celebrate();
  };

  const remove = (id: string) => {
    const removed = deleteWeighIn(id);
    if (!removed) return;
    toast('Entry deleted', { undo: () => restoreWeighIn(removed) });
  };

  return (
    <Stack as="section" aria-label="Bodyweight">
      <SectionHeading>Bodyweight</SectionHeading>
      <StatStrip>
        <StatTile label="Latest" value={latest ? `${toDisplayWeight(latest.weight, unit)}` : '--'} sub={unit} />
        <StatTile label="Goal" value={`${goalDisplay}`} sub={unit} />
        <StatTile
          label="Change"
          value={latest && first && history.length > 1 ? fmtNum(toDisplayWeight(latest.weight - first.weight, unit)) : '--'}
          sub={history.length > 1 ? `${unit} since first` : undefined}
        />
      </StatStrip>

      <Card>
        <CardTitle>Log today&apos;s weight</CardTitle>
        <FormRow>
          <NumberInput
            label={`Today's weight (${unit})`}
            step={0.1}
            min={0}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="button" onClick={log}>
            Log
          </Button>
        </FormRow>
      </Card>

      {data.length >= MIN_CHART_POINTS ? (
        <Card>
          <ChartFrame title={`Trend (${unit})`} height={200} table={table}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={tokens.grid.stroke} strokeOpacity={tokens.grid.strokeOpacity} />
                <XAxis dataKey="label" tick={tokens.tick} tickLine={false} axisLine={tokens.axisLine} minTickGap={24} />
                <YAxis
                  tick={tokens.tick}
                  width={48}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                  /* Auto ticks land on values like 130.15, which overflow the
                     axis and render clipped. Weigh-ins carry one decimal. */
                  tickFormatter={(v: number) => String(Math.round(v * 10) / 10)}
                />
                <Tooltip
                  contentStyle={tokens.tooltipContentStyle}
                  labelStyle={tokens.tooltipLabelStyle}
                  itemStyle={tokens.tooltipItemStyle}
                  formatter={(value, name) => [
                    `${String(value)}${unit}`,
                    name === 'trend' ? '7-day avg' : 'Weight',
                  ]}
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
                <Area
                  type="monotone"
                  dataKey="trend"
                  stroke={tokens.colors.accentText}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  fill="none"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={!reduced}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Card>
      ) : null}

      <Card>
        {history.length === 0 ? (
          <EmptyState icon={Scale} title="No weigh-ins logged yet." description="Log today's weight above to start the trend." />
        ) : (
          <div>
            {history.slice(0, 10).map((e) => (
              <HistoryRow key={e.id}>
                <HistoryDate>{displayDate(e.date)}</HistoryDate>
                <HistoryValue>
                  {toDisplayWeight(e.weight, unit)}
                  {unit}
                </HistoryValue>
                <IconButton aria-label={`Delete weigh-in from ${displayDate(e.date)}`} tone="destructive" onClick={() => remove(e.id)}>
                  <X size={18} aria-hidden="true" />
                </IconButton>
              </HistoryRow>
            ))}
          </div>
        )}
      </Card>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Measurements
// ---------------------------------------------------------------------------

function MeasurementsSection({ celebrate }: { celebrate: () => void }) {
  const unit = useSettingsStore((s) => s.unit);
  const measurements = useMeasurementsStore((s) => s.measurements);
  const addMeasurement = useMeasurementsStore((s) => s.addMeasurement);
  const deleteMeasurement = useMeasurementsStore((s) => s.deleteMeasurement);
  const restoreMeasurement = useMeasurementsStore((s) => s.restoreMeasurement);
  // Same fresh-array trap as selectBwHistory — memoize the sorted view.
  const history = useMemo(
    () => [...measurements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [measurements],
  );

  const lengthUnit = unit === 'kg' ? 'cm' : 'in';
  const latest = history[0];
  const first = history[history.length - 1];

  const [waist, setWaist] = useState(() =>
    latest && latest.waist != null ? String(toDisplayLength(latest.waist, unit)) : '',
  );
  const [hips, setHips] = useState(() => (latest && latest.hips != null ? String(toDisplayLength(latest.hips, unit)) : ''));

  const waistDelta =
    latest && first && history.length > 1 && latest.waist != null && first.waist != null
      ? fmtNum((toDisplayLength(latest.waist, unit) ?? 0) - (toDisplayLength(first.waist, unit) ?? 0))
      : '--';

  const log = () => {
    const w = parseFloat(waist);
    const h = parseFloat(hips);
    if (!w && !h) return;
    addMeasurement(w ? fromDisplayLength(w, unit) : null, h ? fromDisplayLength(h, unit) : null);
    celebrate();
  };

  const remove = (id: string) => {
    const removed = deleteMeasurement(id);
    if (!removed) return;
    toast('Measurement deleted', { undo: () => restoreMeasurement(removed) });
  };

  const fmtLen = (v: number | null): string => {
    const d = toDisplayLength(v, unit);
    return d == null ? '--' : `${d}${lengthUnit}`;
  };

  return (
    <Stack as="section" aria-label="Body measurements">
      <SectionHeading>Measurements</SectionHeading>
      <StatStrip>
        <StatTile label="Waist" value={latest && latest.waist != null ? fmtLen(latest.waist) : '--'} />
        <StatTile label="Hips" value={latest && latest.hips != null ? fmtLen(latest.hips) : '--'} />
        <StatTile label="Waist Δ" value={waistDelta} sub={waistDelta !== '--' ? `${lengthUnit} since first` : undefined} />
      </StatStrip>

      <Card>
        <CardTitle>Log body measurements</CardTitle>
        <CardHint>Optional, the scale can stall while these still change</CardHint>
        <TwoFieldRow>
          <NumberInput label={`Waist (${lengthUnit})`} step={0.1} min={0} value={waist} onChange={(e) => setWaist(e.target.value)} />
          <NumberInput label={`Hips (${lengthUnit})`} step={0.1} min={0} value={hips} onChange={(e) => setHips(e.target.value)} />
          <Button type="button" onClick={log}>
            Log
          </Button>
        </TwoFieldRow>
      </Card>

      <Card>
        {history.length === 0 ? (
          <EmptyState icon={Ruler} title="No measurements logged yet." />
        ) : (
          <div>
            {history.slice(0, 10).map((e) => (
              <HistoryRow key={e.id}>
                <HistoryDate>{displayDate(e.date)}</HistoryDate>
                <HistoryValue>
                  W: {fmtLen(e.waist)} / H: {fmtLen(e.hips)}
                </HistoryValue>
                <IconButton
                  aria-label={`Delete measurement from ${displayDate(e.date)}`}
                  tone="destructive"
                  onClick={() => remove(e.id)}
                >
                  <X size={18} aria-hidden="true" />
                </IconButton>
              </HistoryRow>
            ))}
          </div>
        )}
      </Card>
    </Stack>
  );
}

export function BodyTab() {
  const { celebrate, confetti } = useAchievementCelebration();
  return (
    <Stack>
      <BodyweightSection celebrate={celebrate} />
      <MeasurementsSection celebrate={celebrate} />
      {confetti}
    </Stack>
  );
}
