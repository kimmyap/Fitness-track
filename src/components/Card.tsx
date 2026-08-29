import styled from '@emotion/styled';

export const Card = styled.div<{ padded?: boolean }>`
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.cardForeground};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: ${({ theme, padded = true }) => (padded ? theme.space[4] : '0')};
`;
