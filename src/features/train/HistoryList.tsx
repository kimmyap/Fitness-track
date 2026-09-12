/**
 * Exercise history: last 15 entries grouped by date. Each date is a collapse
 * toggle showing weekday + set/warm-up counts + day volume; only the most
 * recent date is open by default. Rows carry variation/RPE tags, a PB star, and
 * repeat / edit / delete actions. Warm-up rows are greyed so they can't be
 * mistaken for working sets.
 *
 * Delete is gated by ConfirmDeleteAction: the first tap only arms the row. The
 * undo toast downstream is the second net, not the first.
 */
import { useState } from 'react';
import styled from '@emotion/styled';
import { Check, ChevronDown, ChevronRight, ClipboardList, Pencil, RotateCw } from 'lucide-react';
import { Badge, ConfirmDeleteAction, EmptyState, IconButton } from '@/components';
import { useEntriesStore, useSettingsStore } from '@/stores';
import { displayDateWithWeekday, entryVolume, historyFor } from '@/lib/domain';
import type { LiftSetEntry } from '@/lib/types';
import { isLiftSet } from '@/lib/types';
import { SetRow, fmtStoredWeight, fmtVolume, unitLabel } from './ui';

/** Day header doubles as the collapse toggle for that day's sets. */
const DayToggle = styled.button`
  width: 100%;
  min-height: ${({ theme }) => theme.touchTarget};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[2]};
  margin-top: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => `${theme.space[1]} ${theme.space[2]}`};
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: transparent;
  font-family: ${({ theme }) => theme.typography.body};
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.mutedForeground};
  font-variant-numeric: tabular-nums;
  text-align: left;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.foreground};
  }
`;

const DayLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
`;

const RowInfo = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  flex-wrap: wrap;
  min-width: 0;
`;

const WeightNum = styled.span<{ pb: boolean; warmup?: boolean }>`
  font-variant-numeric: tabular-nums;
  font-weight: ${({ warmup }) => (warmup ? 500 : 700)};
  color: ${({ theme, pb, warmup }) =>
    warmup ? theme.colors.mutedForeground : pb ? theme.colors.secondary : theme.colors.cardForeground};
`;

const Actions = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: auto;
`;

/**
 * Completed-set badge: sage-green fill + white checkmark (glanceable status).
 * Warm-ups get the muted variant — a green tick would imply a working set.
 */
const CheckMark = styled.span<{ warmup?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-right: ${({ theme }) => theme.space[1]};
  flex: none;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme, warmup }) => (warmup ? theme.colors.muted : theme.colors.accent)};
  color: ${({ theme, warmup }) => (warmup ? theme.colors.mutedForeground : theme.colors.onAccent)};
`;

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
  /*
   * Which row is armed for deletion. A single id, so arming one row disarms any
   * other for free. Session-only by design — a pending delete must never
   * outlive the view, and nothing about it belongs in storage.
   */
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
      {dateOrder.map((date, dayIndex) => {
        const dayRows = grouped[date] as LiftSetEntry[];
        const dayVol = dayRows
          .filter((r) => !r.warmupSet && !r.assistedPullup && r.weight)
          .reduce((s, r) => s + entryVolume(r), 0);
        // Only the most recent day is open by default; everything else starts
        // collapsed so the list stays scannable.
        const isExpanded = expandedDays[date] ?? dayIndex === 0;
        const warmupCount = dayRows.filter((r) => r.warmupSet).length;
        const workingCount = dayRows.length - warmupCount;

        return (
          <div key={date}>
            <DayToggle
              type="button"
              aria-expanded={isExpanded}
              onClick={() => setExpandedDays((m) => ({ ...m, [date]: !isExpanded }))}
            >
              <DayLabel>
                {isExpanded ? (
                  <ChevronDown size={14} aria-hidden="true" />
                ) : (
                  <ChevronRight size={14} aria-hidden="true" />
                )}
                {date === todayIso ? 'Today' : displayDateWithWeekday(date)}
              </DayLabel>
              <span>
                {workingCount} set{workingCount === 1 ? '' : 's'}
                {warmupCount ? ` + ${warmupCount} warm-up` : ''}
                {dayVol ? ` · ${fmtVolume(dayVol, unit)}${unitLabel(unit)} vol` : ''}
              </span>
            </DayToggle>
            {(isExpanded ? dayRows : []).map((r) => {
              const isPB =
                Boolean(best) &&
                r.weight === best?.weight &&
                r.date === best.date &&
                !r.warmupSet &&
                !r.assistedPullup &&
                !r.dropSet;
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
                <SetRow key={r.id} completed warmup={Boolean(r.warmupSet)} editing={r.id === editingId}>
                  <RowInfo>
                    {r.variation ? <Badge>{r.variation}</Badge> : null}
                    {r.dropSet ? <Badge>Drop</Badge> : null}
                    {r.toFailure ? <Badge>Failure</Badge> : null}
                    <span>{setLabel}</span>
                    {r.rpe ? <Badge>RPE {r.rpe}</Badge> : null}
                    <WeightNum pb={isPB} warmup={Boolean(r.warmupSet)}>
                      {weightDisplay}
                    </WeightNum>
                  </RowInfo>
                  <Actions>
                    <CheckMark aria-hidden="true" warmup={Boolean(r.warmupSet)}>
                      <Check size={16} />
                    </CheckMark>
                    <IconButton aria-label={`Repeat this set (${weightDisplay} x ${r.reps})`} onClick={() => onRepeat(r)}>
                      <RotateCw size={16} aria-hidden="true" />
                    </IconButton>
                    <IconButton aria-label={`Edit this set (${weightDisplay} x ${r.reps})`} onClick={() => onEdit(r)}>
                      <Pencil size={16} aria-hidden="true" />
                    </IconButton>
                    <ConfirmDeleteAction
                      target={`this set (${weightDisplay} x ${r.reps})`}
                      armed={pendingDeleteId === r.id}
                      onArm={() => setPendingDeleteId(r.id)}
                      onCancel={() => setPendingDeleteId(null)}
                      onConfirm={() => {
                        setPendingDeleteId(null);
                        onDelete(r);
                      }}
                    />
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
