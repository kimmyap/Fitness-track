import styled from '@emotion/styled';
import { Check } from 'lucide-react';

const Strip = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: ${({ theme }) => theme.space[1]};
  margin-top: ${({ theme }) => theme.space[3]};
`;

const Day = styled.div<{ done: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  padding: ${({ theme }) => `${theme.space[2]} 0`};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme, done }) => (done ? theme.colors.accent : theme.colors.muted)};
  color: ${({ theme, done }) => (done ? theme.colors.onAccent : theme.colors.mutedForeground)};
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  font-weight: 500;
`;

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export interface WeekStripDay {
  /** "YYYY-MM-DD". */
  date: string;
  done: boolean;
}

export interface WeekStripProps {
  /** 7 days, oldest first (legacy: today-6 … today). */
  days: WeekStripDay[];
  /** Accessible description, e.g. "Warm-up completion, last 7 days". */
  label: string;
}

/** 7-day completion strip (check + color, never color alone). */
export function WeekStrip({ days, label }: WeekStripProps) {
  return (
    <Strip role="img" aria-label={label}>
      {days.map((d) => {
        const dow = new Date(`${d.date}T00:00:00`).getDay();
        return (
          <Day key={d.date} done={d.done}>
            <span aria-hidden="true">{DAY_LETTERS[dow]}</span>
            {d.done ? <Check size={12} aria-hidden="true" /> : <span aria-hidden="true">·</span>}
          </Day>
        );
      })}
    </Strip>
  );
}
