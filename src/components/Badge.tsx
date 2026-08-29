import styled from '@emotion/styled';
import type { Theme } from '@emotion/react';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'destructive';

function toneStyles(theme: Theme, tone: BadgeTone) {
  switch (tone) {
    case 'primary':
      return { background: theme.colors.primary, color: theme.colors.onPrimary, borderColor: 'transparent' };
    case 'success':
      return { background: theme.colors.accent, color: theme.colors.onAccent, borderColor: 'transparent' };
    case 'destructive':
      return { background: theme.colors.destructive, color: theme.colors.onDestructive, borderColor: 'transparent' };
    case 'neutral':
    default:
      return { background: theme.colors.muted, color: theme.colors.mutedForeground, borderColor: theme.colors.border };
  }
}

export const Badge = styled.span<{ tone?: BadgeTone }>`
  ${({ theme, tone = 'neutral' }) => toneStyles(theme, tone)};
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  border: 1px solid;
  border-radius: ${({ theme }) => theme.radii.full};
  padding: ${({ theme }) => `${theme.space[1]} ${theme.space[2]}`};
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
`;
