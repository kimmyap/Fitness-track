/**
 * Local styled primitives for the metrics screen.
 *
 * Deliberately NOT imported from `features/train/ui` — this screen is meant to
 * stay independent of the strength logger, so the two can be restyled without
 * dragging each other along. Shared, app-wide primitives still come from
 * `@/components`.
 */
import styled from '@emotion/styled';

export const Stack = styled.div<{ gap?: 1 | 2 | 3 | 4 | 5 }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme, gap = 3 }) => theme.space[gap]};
`;

export const SectionTitle = styled.h2`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.md};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.cardForeground};
`;

export const Hint = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

/** Two fields per row at phone width, collapsing to one when very narrow. */
export const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: ${({ theme }) => theme.space[3]};
`;

export const Row = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space[2]};
`;

/** Segmented choice (energy rating, cardio type). */
export const ChoiceRow = styled.div`
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  overflow: hidden;
`;

export const ChoiceButton = styled.button<{ active: boolean }>`
  min-height: ${({ theme }) => theme.touchTarget};
  min-width: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => `${theme.space[1]} ${theme.space[3]}`};
  border: none;
  background: ${({ theme, active }) => (active ? theme.colors.primary : 'transparent')};
  color: ${({ theme, active }) => (active ? theme.colors.onPrimary : theme.colors.mutedForeground)};
  font-family: ${({ theme }) => theme.typography.body};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-weight: ${({ active }) => (active ? 700 : 500)};
  font-variant-numeric: tabular-nums;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: -2px;
  }
`;

export const DateInput = styled.input`
  min-height: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => `${theme.space[2]} ${theme.space[3]}`};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.cardForeground};
  font-family: ${({ theme }) => theme.typography.body};
  font-size: ${({ theme }) => theme.typography.fontSizes.md};
`;

/** One logged cardio session. */
export const SessionRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[2]};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
`;

export const SessionMain = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

export const SessionLoad = styled.span`
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  white-space: nowrap;
`;
