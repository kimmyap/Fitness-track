import styled from '@emotion/styled';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => `${theme.space[6]} ${theme.space[4]}`};
  text-align: center;
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

const Title = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.display};
  font-weight: 600;
  font-size: ${({ theme }) => theme.typography.fontSizes.lg};
  color: ${({ theme }) => theme.colors.foreground};
`;

const Description = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  max-width: 40ch;
`;

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Single guiding action (never a blank state without one when actionable). */
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Wrap>
      {Icon ? <Icon size={32} aria-hidden="true" /> : null}
      <Title>{title}</Title>
      {description ? <Description>{description}</Description> : null}
      {action}
    </Wrap>
  );
}
