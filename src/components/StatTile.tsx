import styled from '@emotion/styled';
import type { ReactNode } from 'react';

const Tile = styled.div<{ glow?: boolean }>`
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.cardForeground};
  border: 1px solid ${({ theme, glow }) => (glow ? theme.colors.secondary : theme.colors.border)};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => `${theme.space[3]} ${theme.space[3]}`};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
  min-width: 0;
`;

const Label = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  color: ${({ theme }) => theme.colors.mutedForeground};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const Value = styled.span`
  font-family: ${({ theme }) => theme.typography.display};
  font-weight: 700;
  font-size: ${({ theme }) => theme.typography.fontSizes.xl};
  font-variant-numeric: tabular-nums;
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
`;

const Sub = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

export interface StatTileProps {
  label: string;
  value: ReactNode;
  /** Small line under the value (e.g. fire-tier label). */
  sub?: ReactNode;
  /** Decorative icon next to the value — hidden from screen readers. */
  icon?: ReactNode;
  /** Emphasized border for fire-tier ≥7 streaks. */
  glow?: boolean;
}

export function StatTile({ label, value, sub, icon, glow }: StatTileProps) {
  return (
    <Tile glow={glow}>
      <Label>{label}</Label>
      <Value>
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        {value}
      </Value>
      {sub ? <Sub>{sub}</Sub> : null}
    </Tile>
  );
}

/** Convenience 3-up strip used by stats rows. */
export const StatStrip = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${({ theme }) => theme.space[2]};
`;
