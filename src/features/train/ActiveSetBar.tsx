/**
 * Sticky context bar naming the exercise currently being logged.
 *
 * The exercise list runs long enough that the expanded card's own header
 * scrolls out of view while you are typing into its form, leaving no on-screen
 * answer to "which exercise is this set for?". This keeps the name, the set
 * you are about to log, and the target pinned while that card is open.
 */
import styled from '@emotion/styled';
import { Dumbbell } from 'lucide-react';

const Bar = styled.div`
  position: sticky;
  top: ${({ theme }) => theme.space[2]};
  z-index: 39;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  min-height: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => `${theme.space[2]} ${theme.space[3]}`};
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.cardForeground};

  svg {
    flex-shrink: 0;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const Name = styled.span`
  font-family: ${({ theme }) => theme.typography.display};
  font-weight: 700;
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Meta = styled.span`
  margin-left: auto;
  flex-shrink: 0;
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

export interface ActiveSetBarProps {
  exerciseName: string;
  /** Working sets already logged on the logging date. */
  setsLogged: number;
  targetSets: number;
  targetReps: string;
}

export function ActiveSetBar({ exerciseName, setsLogged, targetSets, targetReps }: ActiveSetBarProps) {
  const done = setsLogged >= targetSets;
  return (
    <Bar role="status" aria-live="polite" aria-label="Currently logging">
      <Dumbbell size={16} aria-hidden="true" />
      <Name>{exerciseName}</Name>
      <Meta>
        {done ? `Target met · ${setsLogged}/${targetSets}` : `Set ${setsLogged + 1} of ${targetSets}`} ·{' '}
        {targetReps} reps
      </Meta>
    </Bar>
  );
}
