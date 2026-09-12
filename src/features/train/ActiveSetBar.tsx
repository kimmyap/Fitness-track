/**
 * Sticky context bar naming the exercise currently being logged.
 *
 * The exercise list runs long enough that the expanded card's own header
 * scrolls out of view while you are typing into its form, leaving no on-screen
 * answer to "which exercise is this set for?". This keeps the name, the set
 * you are about to log, and the target pinned while that card is open — and
 * offers a way back to the inputs once it has scrolled away.
 */
import styled from '@emotion/styled';
import { ArrowUp } from 'lucide-react';

/* Pinned by WorkoutDayView's sticky stack, not on its own — see RestTimerBar. */
const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => `${theme.space[1]} ${theme.space[3]}`};
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.radii.lg};
  /* Translucent from the token rather than a hardcoded slate, so it tracks the
     theme; the blur only reads against content scrolling underneath. */
  background: color-mix(in srgb, ${({ theme }) => theme.colors.card} 88%, transparent);
  color: ${({ theme }) => theme.colors.cardForeground};

  @supports (backdrop-filter: blur(8px)) {
    backdrop-filter: blur(8px);
  }
`;

/**
 * Primary, not accent: in this design system green means a set is DONE, so a
 * green pulse on the set you have yet to log would say the opposite.
 */
const LiveDot = styled.span`
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  width: 8px;
  height: 8px;

  span {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.primary};
  }

  @media (prefers-reduced-motion: no-preference) {
    span:first-of-type {
      animation: activeSetPing 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
    }
  }

  @keyframes activeSetPing {
    75%,
    100% {
      transform: scale(2.2);
      opacity: 0;
    }
  }
`;

/* min-width: 0 or the long name refuses to ellipsis inside the flex row. */
const Text = styled.span`
  display: flex;
  flex-direction: column;
  min-width: 0;
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
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.mutedForeground};
  white-space: nowrap;
`;

const JumpButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  flex-shrink: 0;
  margin-left: auto;
  min-height: ${({ theme }) => theme.touchTarget};
  padding: 0 ${({ theme }) => theme.space[2]};
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.radii.md};
  background: transparent;
  color: ${({ theme }) => theme.colors.primary};
  font-family: inherit;
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-weight: 500;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
`;

export interface ActiveSetBarProps {
  exerciseName: string;
  /** Working sets already logged on the logging date. */
  setsLogged: number;
  targetSets: number;
  targetReps: string;
  /** Scrolls the matching card back into view. */
  onJumpToCard?: () => void;
}

export function ActiveSetBar({
  exerciseName,
  setsLogged,
  targetSets,
  targetReps,
  onJumpToCard,
}: ActiveSetBarProps) {
  const done = setsLogged >= targetSets;
  return (
    <Bar role="status" aria-live="polite" aria-label="Currently logging">
      <LiveDot aria-hidden="true">
        <span />
        <span />
      </LiveDot>
      <Text>
        <Name>{exerciseName}</Name>
        <Meta>
          {done ? `Target met · ${setsLogged}/${targetSets}` : `Set ${setsLogged + 1} of ${targetSets}`} ·{' '}
          {targetReps} reps
        </Meta>
      </Text>
      {onJumpToCard ? (
        <JumpButton type="button" onClick={onJumpToCard}>
          Jump to card <ArrowUp size={14} aria-hidden="true" />
        </JumpButton>
      ) : null}
    </Bar>
  );
}
