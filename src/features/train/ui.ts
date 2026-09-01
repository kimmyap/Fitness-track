/** Shared styled primitives + tiny format helpers for the Train/Today features. */
import styled from '@emotion/styled';
import { InputBase } from '@/components';
import { toDisplayWeight } from '@/lib/domain';
import { isoDate } from '@/lib/domain';
import type { Unit } from '@/lib/types';

// ---------------------------------------------------------------------------
// Format helpers (legacy display conventions)
// ---------------------------------------------------------------------------

/** Legacy unitLabel(): "lbs" | "kg". */
export function unitLabel(unit: Unit): string {
  return unit === 'kg' ? 'kg' : 'lbs';
}

/** Stored lbs → "135lbs" / "61.2kg" (legacy inline weight display). */
export function fmtStoredWeight(lbs: number, unit: Unit): string {
  return `${toDisplayWeight(lbs, unit)}${unitLabel(unit)}`;
}

/** Stored lbs → rounded, thousands-separated display number (volume recaps). */
export function fmtVolume(lbs: number, unit: Unit): string {
  return Math.round(toDisplayWeight(lbs, unit)).toLocaleString();
}

/** m:ss for the rest timer. */
export function fmtTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Last 7 local dates (oldest first): today-6 … today. */
export function last7Dates(now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(isoDate(d));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Styled primitives
// ---------------------------------------------------------------------------

/** Vertical page/card stack. */
export const Stack = styled.div<{ gap?: 1 | 2 | 3 | 4 | 5 }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme, gap = 3 }) => theme.space[gap]};
`;

/** Horizontal row of controls. (`wrap` must not leak to the DOM — it's a valid HTML attr name.) */
export const Row = styled('div', { shouldForwardProp: (prop) => prop !== 'wrap' })<{ wrap?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  flex-wrap: ${({ wrap }) => (wrap ? 'wrap' : 'nowrap')};
`;

/** Card section heading (legacy gt-ex-name). */
export const CardTitle = styled.h3`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.md};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.cardForeground};
`;

/** Small muted helper text (legacy gt-target). */
export const Muted = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

/** Two-column list row with a hairline top border (legacy gt-set-row). */
export const SetRow = styled.div<{ noBorder?: boolean; completed?: boolean; editing?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[2]};
  flex-wrap: wrap;
  padding: ${({ theme }) => `${theme.space[2]}`};
  border-top: ${({ theme, noBorder }) => (noBorder ? 'none' : `1px solid ${theme.colors.border}`)};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  border-radius: ${({ theme }) => theme.radii.sm};

  /* Logged set: sage-green tint + left rule. Reinforced by the checkmark and
     the set label, so meaning is never carried by colour alone. */
  ${({ theme, completed }) =>
    completed
      ? `background: color-mix(in srgb, ${theme.colors.accent} 14%, transparent);
         box-shadow: inset 3px 0 0 ${theme.colors.accent};`
      : ''}

  /* The set currently being edited gets the orange active border. */
  ${({ theme, editing }) =>
    editing ? `outline: 2px solid ${theme.colors.primary}; outline-offset: -2px;` : ''}
`;

/** Info box (form cues / notes; legacy gt-info-box). */
export const InfoBox = styled.div`
  background: ${({ theme }) => theme.colors.muted};
  color: ${({ theme }) => theme.colors.foreground};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.space[3]};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
`;

/** Suggestion box (progression ladder; legacy gt-suggest-box). */
export const SuggestBox = styled.div`
  background: ${({ theme }) => theme.colors.muted};
  border: 1px solid ${({ theme }) => theme.colors.accent};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.space[3]};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  align-items: flex-start;
`;

/** Inline text-button (legacy gt-clear links) — still a ≥44px touch target. */
export const TextButton = styled.button`
  display: inline-flex;
  align-items: center;
  min-height: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => `${theme.space[1]} ${theme.space[2]}`};
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.mutedForeground};
  font-family: ${({ theme }) => theme.typography.body};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  text-decoration: underline;
  cursor: pointer;
  text-align: left;

  &:hover {
    color: ${({ theme }) => theme.colors.foreground};
  }
`;

/** Positive trend text (up arrow rendered as text, never color-only). */
export const TrendUp = styled.span`
  color: ${({ theme }) => theme.colors.accentText};
  font-weight: 600;
`;

/** Negative trend text. */
export const TrendDown = styled.span`
  color: ${({ theme }) => theme.colors.destructive};
  font-weight: 600;
`;

/** Themed <select> matching the input styling (44px target). */
export const SelectBase = styled.select`
  min-height: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => `${theme.space[2]} ${theme.space[3]}`};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.cardForeground};
  font-family: ${({ theme }) => theme.typography.body};
  font-size: ${({ theme }) => theme.typography.fontSizes.md};
  width: 100%;
`;

/** Themed textarea matching the input styling. */
export const TextAreaBase = InputBase.withComponent('textarea');

/** Numbers in flowing text keep tabular figures. */
export const Num = styled.span`
  font-variant-numeric: tabular-nums;
  font-weight: 700;
`;
