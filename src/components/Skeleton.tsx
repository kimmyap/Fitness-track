import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';

const shimmer = keyframes`
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
`;

/**
 * Skeleton placeholder (use over spinners for >1s loads). Shimmer sweeps the
 * background gradient; under prefers-reduced-motion it renders a static block.
 */
export const Skeleton = styled.div<{ width?: string; height?: string; radius?: string }>`
  width: ${({ width = '100%' }) => width};
  height: ${({ height = '16px' }) => height};
  border-radius: ${({ theme, radius }) => radius ?? theme.radii.sm};
  background: ${({ theme }) =>
    `linear-gradient(90deg, ${theme.colors.muted} 25%, ${theme.colors.border} 50%, ${theme.colors.muted} 75%)`};
  background-size: 200% 100%;
  animation: ${shimmer} ${({ theme }) => theme.motion.duration.shimmer} ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    background: ${({ theme }) => theme.colors.muted};
  }
`;
