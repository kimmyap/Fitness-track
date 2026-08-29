import { useEffect, useMemo } from 'react';
import styled from '@emotion/styled';
import { keyframes, useTheme } from '@emotion/react';
import { useReducedMotion } from './useReducedMotion';

const fall = keyframes`
  from { transform: translateY(-8vh) rotate(0deg); opacity: 1; }
  to { transform: translateY(108vh) rotate(540deg); opacity: 0; }
`;

const Layer = styled.div`
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 300;
`;

const Piece = styled.span`
  position: absolute;
  top: 0;
  display: block;
  animation-name: ${fall};
  animation-timing-function: ${({ theme }) => theme.motion.easing.inOut};
  animation-fill-mode: forwards;
  will-change: transform, opacity;
`;

export interface ConfettiProps {
  /** Render a burst while true; parent clears it via onDone. */
  active: boolean;
  onDone?: () => void;
  pieces?: number;
}

/**
 * PR/achievement confetti (legacy: 24 pieces). Transform/opacity only; a
 * complete no-op under prefers-reduced-motion (onDone still fires).
 */
export function Confetti({ active, onDone, pieces = 24 }: ConfettiProps) {
  const reducedMotion = useReducedMotion();
  const theme = useTheme();

  const items = useMemo(() => {
    if (!active) return [];
    const colors = [theme.colors.primary, theme.colors.secondary, theme.colors.accent];
    return Array.from({ length: pieces }, (_, i) => ({
      key: i,
      left: `${Math.random() * 100}%`,
      size: 5 + Math.random() * 5,
      color: colors[i % colors.length] as string,
      round: Math.random() > 0.5,
      duration: 1.6 + Math.random() * 1.2,
      delay: Math.random() * 0.3,
    }));
  }, [active, pieces, theme]);

  const maxMs = active && !reducedMotion ? Math.max(...items.map((p) => (p.duration + p.delay) * 1000)) + 200 : 0;

  useEffect(() => {
    if (!active || !onDone) return;
    const t = setTimeout(onDone, reducedMotion ? 0 : maxMs);
    return () => clearTimeout(t);
  }, [active, onDone, reducedMotion, maxMs]);

  if (!active || reducedMotion) return null;

  return (
    <Layer aria-hidden="true">
      {items.map((p) => (
        <Piece
          key={p.key}
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.round ? '50%' : '2px',
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </Layer>
  );
}
