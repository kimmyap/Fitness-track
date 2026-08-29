/**
 * Month grid with prev/next nav + legend (legacy renderCalendar). Trained
 * days highlighted, warm-up/core/activity days dotted, today outlined,
 * selected ringed. Keyboard: arrow keys move between days (rolling across
 * months), Home/End jump within the month, Enter/Space selects.
 */
import { useEffect, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@/components';
import {
  addDaysIso,
  DOW_HEADERS,
  isoFor,
  MONTH_NAMES,
  monthCells,
  monthLabel,
  type DayFlags,
} from './calendarMath';

const Nav = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[2]};
  margin-bottom: ${({ theme }) => theme.space[2]};
`;

const MonthTitle = styled.h2`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.lg};
  font-weight: 600;
`;

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => `${theme.space[1]} ${theme.space[4]}`};
  margin-bottom: ${({ theme }) => theme.space[3]};
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  color: ${({ theme }) => theme.colors.mutedForeground};

  > span {
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.space[1]};
  }
`;

const TrainedSwatch = styled.span`
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: color-mix(in srgb, ${({ theme }) => theme.colors.accent} 22%, transparent);
  border: 1px solid ${({ theme }) => theme.colors.accent};
`;

const ActivityDotSwatch = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.secondary};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: ${({ theme }) => theme.space[1]};
`;

const Dow = styled.div`
  text-align: center;
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  font-weight: 500;
  color: ${({ theme }) => theme.colors.mutedForeground};
  padding: ${({ theme }) => `${theme.space[1]} 0`};
`;

const DayButton = styled.button<{ trained: boolean; isToday: boolean; isSelected: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: ${({ theme }) => theme.touchTarget};
  width: 100%;
  padding: ${({ theme }) => theme.space[1]};
  border: 1px solid ${({ theme, trained }) => (trained ? theme.colors.accent : 'transparent')};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme, trained }) =>
    trained ? `color-mix(in srgb, ${theme.colors.accent} 22%, transparent)` : 'transparent'};
  color: ${({ theme }) => theme.colors.foreground};
  font-family: ${({ theme }) => theme.typography.body};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-weight: ${({ trained }) => (trained ? 700 : 400)};
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  box-shadow: ${({ theme, isToday, isSelected }) =>
    [isToday ? `inset 0 0 0 2px ${theme.colors.primary}` : null, isSelected ? `0 0 0 2px ${theme.colors.ring}` : null]
      .filter(Boolean)
      .join(', ') || 'none'};
  transition: opacity ${({ theme }) => `${theme.motion.duration.fast} ${theme.motion.easing.out}`};

  &:hover {
    opacity: 0.85;
  }
`;

const ActivityDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.secondary};
`;

const EmptyCell = styled.div`
  min-height: ${({ theme }) => theme.touchTarget};
`;

export interface MonthGridProps {
  year: number;
  monthIndex: number;
  flags: Record<string, DayFlags>;
  todayIso: string;
  selectedDate: string | null;
  onSelect: (iso: string) => void;
  onMonthChange: (year: number, monthIndex: number) => void;
}

export function MonthGrid({ year, monthIndex, flags, todayIso, selectedDate, onSelect, onMonthChange }: MonthGridProps) {
  const cells = monthCells(year, monthIndex);
  const days = cells.filter((c): c is NonNullable<typeof c> => c !== null);
  const firstIso = days[0]?.iso ?? isoFor(year, monthIndex, 1);
  const lastIso = days[days.length - 1]?.iso ?? firstIso;

  const inMonth = (iso: string) => iso.startsWith(`${year}-${String(monthIndex + 1).padStart(2, '0')}-`);

  // Roving tabindex: one day is focusable; arrows move it.
  const [focusIso, setFocusIso] = useState<string>(() =>
    selectedDate && inMonth(selectedDate) ? selectedDate : inMonth(todayIso) ? todayIso : firstIso,
  );
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);

  // Keep the focus target inside the visible month when the month changes.
  const effectiveFocusIso = inMonth(focusIso) ? focusIso : inMonth(todayIso) ? todayIso : firstIso;

  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    const btn = gridRef.current?.querySelector<HTMLButtonElement>(`button[data-iso="${effectiveFocusIso}"]`);
    btn?.focus();
  });

  const moveFocus = (targetIso: string) => {
    setFocusIso(targetIso);
    pendingFocus.current = true;
    if (!inMonth(targetIso)) {
      const [y, m] = targetIso.split('-').map((p) => parseInt(p, 10));
      onMonthChange(y ?? year, (m ?? monthIndex + 1) - 1);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent, iso: string) => {
    let target: string | null = null;
    if (e.key === 'ArrowRight') target = addDaysIso(iso, 1);
    else if (e.key === 'ArrowLeft') target = addDaysIso(iso, -1);
    else if (e.key === 'ArrowDown') target = addDaysIso(iso, 7);
    else if (e.key === 'ArrowUp') target = addDaysIso(iso, -7);
    else if (e.key === 'Home') target = firstIso;
    else if (e.key === 'End') target = lastIso;
    if (target) {
      e.preventDefault();
      moveFocus(target);
    }
  };

  const shift = (delta: 1 | -1) => {
    let m = monthIndex + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y--;
    } else if (m > 11) {
      m = 0;
      y++;
    }
    onMonthChange(y, m);
  };

  const dayAriaLabel = (iso: string, day: number, f: DayFlags | undefined) => {
    const parts = [`${MONTH_NAMES[monthIndex]} ${day}, ${year}`];
    if (f?.hasLift) parts.push('trained');
    if (f?.hasActivity) parts.push('warm-up, core or activity logged');
    if (iso === todayIso) parts.push('today');
    return parts.join(', ');
  };

  return (
    <div>
      <Nav>
        <IconButton aria-label="Previous month" onClick={() => shift(-1)}>
          <ChevronLeft size={20} aria-hidden="true" />
        </IconButton>
        <MonthTitle aria-live="polite">{monthLabel(year, monthIndex)}</MonthTitle>
        <IconButton aria-label="Next month" onClick={() => shift(1)}>
          <ChevronRight size={20} aria-hidden="true" />
        </IconButton>
      </Nav>

      <Legend>
        <span>
          <TrainedSwatch aria-hidden="true" />
          Gym day
        </span>
        <span>
          <ActivityDotSwatch aria-hidden="true" />
          Warm-up / Core / Pilates / Volleyball
        </span>
      </Legend>

      <Grid ref={gridRef}>
        {DOW_HEADERS.map((d, i) => (
          <Dow key={i} aria-hidden="true">
            {d}
          </Dow>
        ))}
        {cells.map((cell, i) =>
          cell === null ? (
            <EmptyCell key={`empty-${i}`} aria-hidden="true" />
          ) : (
            <DayButton
              key={cell.iso}
              type="button"
              data-iso={cell.iso}
              trained={Boolean(flags[cell.iso]?.hasLift)}
              isToday={cell.iso === todayIso}
              isSelected={cell.iso === selectedDate}
              aria-label={dayAriaLabel(cell.iso, cell.day, flags[cell.iso])}
              aria-pressed={cell.iso === selectedDate}
              aria-current={cell.iso === todayIso ? 'date' : undefined}
              tabIndex={cell.iso === effectiveFocusIso ? 0 : -1}
              onClick={() => {
                setFocusIso(cell.iso);
                onSelect(cell.iso);
              }}
              onKeyDown={(e) => onKeyDown(e, cell.iso)}
            >
              {cell.day}
              {flags[cell.iso]?.hasActivity ? <ActivityDot aria-hidden="true" /> : null}
            </DayButton>
          ),
        )}
      </Grid>
    </div>
  );
}
