/**
 * Exercise history: last 15 entries grouped by date. Each date is a collapse
 * toggle showing weekday + set/warm-up counts + day volume; only the most
 * recent date is open by default. Warm-up rows are greyed so they can't be
 * mistaken for working sets.
 *
 * Each set is three columns — set label | load | status — and the row itself is
 * the only tap target: it opens that row's action strip (repeat / edit /
 * delete). Rows used to carry those three icon buttons inline, which put a
 * destructive control in a dense list exactly where a thumb scrolls. Delete is
 * still gated by ConfirmDeleteAction inside the strip; the undo toast
 * downstream is the third net now, not the first.
 */
import { useState } from 'react';
import styled from '@emotion/styled';
import { Check, ChevronDown, ChevronRight, ClipboardList, Pencil, RotateCw } from 'lucide-react';
import { Badge, ConfirmDeleteAction, EmptyState, IconButton, RowMenu, RowMenuLabel } from '@/components';
import { useEntriesStore, useSettingsStore } from '@/stores';
import { displayDateWithWeekday, entryVolume, historyFor } from '@/lib/domain';
import type { LiftSetEntry } from '@/lib/types';
import { isLiftSet } from '@/lib/types';
import {
  LoadCell,
  LoggedSetRow,
  SetLabelCell,
  SrOnly,
  StatusCell,
  fmtStoredWeight,
  fmtVolume,
  unitLabel,
} from './ui';

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

/** Variation reads as an aside to the load, not as its own tagged field. */
const Meta = styled.span`
  font-weight: 500;
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

/** PB star: colour plus a glyph plus announced text, never colour alone. */
const PbStar = styled.span`
  color: ${({ theme }) => theme.colors.secondary};
  font-weight: 700;
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
   * Which row has its actions open, and which is armed for deletion. Single ids,
   * so opening or arming one row closes the other for free. Session-only by
   * design — neither a pending delete nor an open strip belongs in storage.
   */
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const closeRow = () => {
    setOpenRowId(null);
    setPendingDeleteId(null);
  };

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
              // Column 1 names the set; the reps moved into the load column.
              const setLabel = r.warmupSet
                ? 'Warm-up'
                : r.sets && r.sets > 1
                  ? `${r.sets} sets`
                  : `Set ${setNumber(r)}`;
              const weightText = r.assistedPullup
                ? `${fmtStoredWeight(r.weight, unit)} assist`
                : !r.weight && (r.variation === 'Bodyweight' || r.variation === 'Bodyweight Lunges')
                  ? 'Bodyweight'
                  : fmtStoredWeight(r.weight, unit);
              const loadText = `${weightText} × ${r.reps}${r.rpe ? ` @${r.rpe}` : ''}`;
              const rowName = `${setLabel}, ${loadText}`;
              const isOpen = openRowId === r.id;
              return (
                <RowMenu
                  key={r.id}
                  label={rowName}
                  open={isOpen}
                  onToggle={() => {
                    setPendingDeleteId(null);
                    setOpenRowId(isOpen ? null : r.id);
                  }}
                  onClose={closeRow}
                  actions={
                    <>
                      {/* Acting closes the strip — the row is done being worked on. */}
                      <IconButton
                        aria-label={`Repeat ${rowName}`}
                        onClick={() => {
                          closeRow();
                          onRepeat(r);
                        }}
                      >
                        <RotateCw size={16} aria-hidden="true" />
                        <RowMenuLabel>Repeat</RowMenuLabel>
                      </IconButton>
                      <IconButton
                        aria-label={`Edit ${rowName}`}
                        onClick={() => {
                          closeRow();
                          onEdit(r);
                        }}
                      >
                        <Pencil size={16} aria-hidden="true" />
                        <RowMenuLabel>Edit</RowMenuLabel>
                      </IconButton>
                      <ConfirmDeleteAction
                        target={`this set (${rowName})`}
                        idleLabel="Delete"
                        armed={pendingDeleteId === r.id}
                        onArm={() => setPendingDeleteId(r.id)}
                        onCancel={() => setPendingDeleteId(null)}
                        onConfirm={() => {
                          closeRow();
                          onDelete(r);
                        }}
                      />
                    </>
                  }
                >
                  {(trigger) => (
                    <LoggedSetRow
                      {...trigger}
                      completed
                      warmup={Boolean(r.warmupSet)}
                      editing={r.id === editingId}
                      expanded={isOpen}
                    >
                      <SetLabelCell>
                        {/* Pills are reserved for set types; a set number is plain text. */}
                        {r.warmupSet ? <Badge>Warm-up</Badge> : setLabel}
                      </SetLabelCell>
                      <LoadCell>
                        {loadText}
                        {r.variation ? <Meta> · {r.variation}</Meta> : null}
                      </LoadCell>
                      <StatusCell>
                        {r.dropSet ? <Badge>Drop</Badge> : null}
                        {r.toFailure ? <Badge>Failure</Badge> : null}
                        {isPB ? (
                          <PbStar>
                            ★<SrOnly>personal best</SrOnly>
                          </PbStar>
                        ) : null}
                        <CheckMark aria-hidden="true" warmup={Boolean(r.warmupSet)}>
                          <Check size={16} />
                        </CheckMark>
                      </StatusCell>
                    </LoggedSetRow>
                  )}
                </RowMenu>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
