import styled from '@emotion/styled';
import type { ReactNode } from 'react';

const Wrap = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[3]};
  margin-bottom: ${({ theme }) => theme.space[5]};
`;

const Title = styled.h1`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.display};
  font-weight: 700;
  font-size: ${({ theme }) => theme.typography.fontSizes.xl};
  color: ${({ theme }) => theme.colors.foreground};
`;

const Subtitle = styled.p`
  margin: ${({ theme }) => `${theme.space[1]} 0 0`};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned actions. */
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <Wrap>
      <div>
        <Title>{title}</Title>
        {subtitle ? <Subtitle>{subtitle}</Subtitle> : null}
      </div>
      {actions}
    </Wrap>
  );
}
