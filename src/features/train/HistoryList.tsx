/**
 * Exercise history (legacy): last 15 entries grouped by day, day headers with
 * set count + day volume, days with >4 sets collapsed to the last 4, rows with
 * variation/RPE tags, PB star, and repeat / edit / delete actions.
 */
import { useState } from 'react';
import styled from '@emotion/styled';
import { Check, ClipboardList, Pencil, RotateCw, X } from 'lucide-react';
import { Badge, EmptyState, IconButton } from '@/components';
import { useEntriesStore, useSettingsStore } from '@/stores';
import { displayDate, entryVolume, historyFor } from '@/lib/domain';
import type { LiftSetEntry } from '@/lib/types';
import { isLiftSet } from '@/lib/types';
import { SetRow, TextButton, fmtStoredWeight, fmtVolume, unitLabel } from './ui';

const DayHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[2]};
  margin-top: ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.mutedForeground};
  font-variant-numeric: tabular-nums;
`;

const RowInfo = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  flex-wrap: wrap;
  min-width: 0;
`;

const WeightNum = styled.span<{ pb: boolean }>`
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: ${({ theme, pb }) => (pb ? theme.colors.secondary : theme.colors.cardForeground)};
`;

const Actions = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: auto;
`;

/** Completed-set badge: sage-green fill + white checkmark (glanceable status). */
const CheckMark = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-right: ${({ theme }) => theme.space[1]};
  flex: none;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.onAccent};
`;

const HISTORY_DAY_COLLAPSE_THRESHOLD = 4;

export interface HistoryListProps {
  exerciseName: string;
  best: LiftSetEntry | null;
  todayIso: string;
  onRepeat: (entry: LiftSetEntry) => void;
  onEdit: (entry: LiftSetEntry) => void;
  onDelete: (entry: LiftSetEntry) => void;
  /** Set currently open in the edit form — gets the orange active border. */
  editingId?: string | null;
}

export function HistoryList({
  exerciseName,
  best,
  todayIso,
  onRepeat,
  onEdit,
  onDelete,
  editingId = null,
}: HistoryListProps) {
  const entries = useEntriesStore((s) => s.entries);
  const unit = useSettingsStore((s) => s.unit);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const rows = historyFor(entries, exerciseName);
  if (rows.length === 0) {
    return <EmptyState icon={ClipboardList} title="No sets logged yet" description="Add your first below." />;
  }

  /** 1-based working-set number within the day (legacy setNumberInDay). */
  const setNumber = (entry: LiftSetEntry): number => {
    const sameDay = entries.filter(
      (e): e is LiftSetEntry =>
        isLiftSet(e) && e.exercise === entry.exercise && e.date === entry.date && !e.warmupSet,
    );
    return sameDay.findIndex((e) => e.id === entry.id) + 1;
  };

  const grouped: Record<string, LiftSetEntry[]> = {};
  const dateOrder: string[] = [];
  rows.forEach((r) => {
    if (!grouped[r.date]) {
      grouped[r.date] = [];
      dateOrder.push(r.date);
    }
    (grouped[r.date] as LiftSetEntry[]).push(r);
  });

  return (
    <div>
      {dateOrder.map((date) => {
        const dayRows = grouped[date] as LiftSetEntry[];
        const dayVol = dayRows
          .filter((r) => !r.warmupSet && !r.assistedPullup && r.weight)
          .reduce((s, r) => s + entryVolume(r), 0);
        const isExpanded = Boolean(expandedDays[date]);
        const visibleRows =
          dayRows.length > HISTORY_DAY_COLLAPSE_THRESHOLD && !isExpanded
            ? dayRows.slice(-HISTORY_DAY_COLLAPSE_THRESHOLD)
            : dayRows;
        const hiddenCount = dayRows.length - visibleRows.length;

        return (
          <div key={date}>
            <DayHeader>
              <span>{date === todayIso ? 'Today' : displayDate(date)}</span>
              <span>
                {dayRows.length} set{dayRows.length > 1 ? 's' : ''}
                {dayVol ? ` · ${fmtVolume(dayVol, unit)}${unitLabel(unit)} vol` : ''}
              </span>
            </DayHeader>
            {hiddenCount > 0 ? (
              <TextButton onClick={() => setExpandedDays((m) => ({ ...m, [date]: true }))}>
                Show {hiddenCount} earlier set{hiddenCount > 1 ? 's' : ''} from this day
              </TextButton>
            ) : null}
            {visibleRows.map((r) => {
              const isPB =
                Boolean(best) &&
                r.weight === best?.weight &&
                r.date === best.date &&
                !r.warmupSet &&
                !r.assistedPullup;
              const setLabel = r.warmupSet
                ? `Warm-up · ${r.reps} reps`
                : r.sets && r.sets > 1
                  ? `${r.sets}x${r.reps}`
                  : `Set ${setNumber(r)} · ${r.reps} reps`;
              const weightDisplay = r.assistedPullup
                ? `${fmtStoredWeight(r.weight, unit)} assist`
                : !r.weight && (r.variation === 'Bodyweight' || r.variation === 'Bodyweight Lunges')
                  ? 'Bodyweight'
                  : `${fmtStoredWeight(r.weight, unit)}${isPB ? ' ★' : ''}`;
              return (
                <SetRow key={r.id} completed editing={r.id === editingId}>
                  <RowInfo>
                    {r.variation ? <Badge>{r.variation}</Badge> : null}
                    <span>{setLabel}</span>
                    {r.rpe ? <Badge>RPE {r.rpe}</Badge> : null}
                    <WeightNum pb={isPB}>{weightDisplay}</WeightNum>
                  </RowInfo>
                  <Actions>
                    <CheckMark aria-hidden="true">
                      <Check size={16} />
                    </CheckMark>
                    <IconButton aria-label={`Repeat this set (${weightDisplay} x ${r.reps})`} onClick={() => onRepeat(r)}>
                      <RotateCw size={16} aria-hidden="true" />
                    </IconButton>
                    <IconButton aria-label={`Edit this set (${weightDisplay} x ${r.reps})`} onClick={() => onEdit(r)}>
                      <Pencil size={16} aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      aria-label={`Delete this set (${weightDisplay} x ${r.reps})`}
                      tone="destructive"
                      onClick={() => onDelete(r)}
                    >
                      <X size={16} aria-hidden="true" />
                    </IconButton>
                  </Actions>
                </SetRow>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
