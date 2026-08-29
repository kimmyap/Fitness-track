/**
 * Sticky rest-timer bar (legacy gt-timer-bar): 60/90/120s presets,
 * Start/Pause toggle, Reset. Beeps + vibrates at zero (see restTimer.ts).
 */
import styled from '@emotion/styled';
import { REST_TIMER_PRESETS } from '@/lib/domain';
import { fmtTime } from './ui';
import { unlockAudio, useRestTimerStore } from './restTimer';

const Bar = styled.div`
  position: sticky;
  top: ${({ theme }) => theme.space[2]};
  z-index: 40;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  flex-wrap: wrap;
  background: ${({ theme }) => theme.colors.foreground};
  color: ${({ theme }) => theme.colors.background};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => `${theme.space[2]} ${theme.space[3]}`};
`;

const Display = styled.span<{ done: boolean }>`
  font-family: ${({ theme }) => theme.typography.display};
  font-variant-numeric: tabular-nums;
  font-size: ${({ theme }) => theme.typography.fontSizes.xl};
  font-weight: 700;
  min-width: 4ch;
  color: ${({ theme, done }) => (done ? theme.colors.accent : 'inherit')};
`;

const TimerButton = styled.button`
  min-height: ${({ theme }) => theme.touchTarget};
  min-width: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => `${theme.space[1]} ${theme.space[2]}`};
  border: 1px solid ${({ theme }) => theme.colors.mutedForeground};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: transparent;
  color: inherit;
  font-family: ${({ theme }) => theme.typography.body};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-variant-numeric: tabular-nums;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.background};
  }
`;

const GoButton = styled(TimerButton)`
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.onPrimary};
  border-color: transparent;
  font-weight: 700;
`;

const Group = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[1]};
  align-items: center;
`;

const Spacer = styled.div`
  flex: 1;
`;

export function RestTimerBar() {
  const secondsLeft = useRestTimerStore((s) => s.secondsLeft);
  const running = useRestTimerStore((s) => s.running);
  const start = useRestTimerStore((s) => s.start);
  const pause = useRestTimerStore((s) => s.pause);
  const reset = useRestTimerStore((s) => s.reset);

  return (
    <Bar>
      <Display done={secondsLeft === 0 && !running} role="timer" aria-label="Rest timer">
        {fmtTime(secondsLeft)}
      </Display>
      <Group>
        {REST_TIMER_PRESETS.map((preset) => (
          <TimerButton
            key={preset}
            type="button"
            onClick={() => {
              unlockAudio();
              start(preset);
            }}
          >
            {preset}s
          </TimerButton>
        ))}
      </Group>
      <Spacer />
      <Group>
        <GoButton
          type="button"
          onClick={() => {
            unlockAudio();
            if (running) pause();
            else start();
          }}
        >
          {running ? 'Pause' : 'Start'}
        </GoButton>
        <TimerButton type="button" onClick={reset}>
          Reset
        </TimerButton>
      </Group>
    </Bar>
  );
}
