/**
 * Mini inline SVG line chart of the last 10 working-set weights
 * (legacy buildMiniChart), with first/last date-weight labels.
 */
import { useTheme } from '@emotion/react';
import { useEntriesStore, useSettingsStore } from '@/stores';
import { displayDate, toDisplayWeight } from '@/lib/domain';
import { isLiftSet } from '@/lib/types';
import type { LiftSetEntry } from '@/lib/types';
import { Muted, SetRow, fmtStoredWeight } from './ui';

export function MiniChart({ exerciseName }: { exerciseName: string }) {
  const entries = useEntriesStore((s) => s.entries);
  const unit = useSettingsStore((s) => s.unit);
  const theme = useTheme();

  const rows = entries
    .filter(
      (e): e is LiftSetEntry =>
        isLiftSet(e) && e.exercise === exerciseName && Boolean(e.weight) && !e.warmupSet && !e.assistedPullup,
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-10);

  if (rows.length < 2) {
    return <Muted>Log a couple more sessions to see a trend line here.</Muted>;
  }

  const W = 280;
  const H = 90;
  const pad = 10;
  const weights = rows.map((r) => toDisplayWeight(r.weight, unit));
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const stepX = (W - pad * 2) / (rows.length - 1);
  const points = weights.map((w, i): [number, number] => [
    pad + i * stepX,
    H - pad - ((w - min) / range) * (H - pad * 2),
  ]);
  const pathD = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const first = rows[0] as LiftSetEntry;
  const last = rows[rows.length - 1] as LiftSetEntry;

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 80 }}
        role="img"
        aria-label={`Weight trend for ${exerciseName}, last ${rows.length} working sets: ${fmtStoredWeight(first.weight, unit)} on ${displayDate(first.date)} to ${fmtStoredWeight(last.weight, unit)} on ${displayDate(last.date)}`}
      >
        <path d={pathD} fill="none" stroke={theme.colors.accent} strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={theme.colors.secondary} />
        ))}
      </svg>
      <SetRow noBorder>
        <Muted as="span">
          {displayDate(first.date)} · {fmtStoredWeight(first.weight, unit)}
        </Muted>
        <Muted as="span">
          {displayDate(last.date)} · {fmtStoredWeight(last.weight, unit)}
        </Muted>
      </SetRow>
    </>
  );
}
