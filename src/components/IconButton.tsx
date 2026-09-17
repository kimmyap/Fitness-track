import styled from '@emotion/styled';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

const IconButtonBase = styled.button<{ tone?: 'default' | 'destructive' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: ${({ theme }) => theme.touchTarget};
  min-width: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => theme.space[2]};
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.radii.md};
  background: transparent;
  color: ${({ theme, tone }) => (tone === 'destructive' ? theme.colors.destructiveText : theme.colors.foreground)};
  cursor: pointer;
  transition: opacity ${({ theme }) => `${theme.motion.duration.fast} ${theme.motion.easing.out}`};

  &:hover:not(:disabled) {
    opacity: 0.8;
    background: ${({ theme }) => theme.colors.muted};
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

export interface IconButtonProps extends ComponentPropsWithoutRef<'button'> {
  /** Required — icon-only buttons must be labelled for screen readers. */
  'aria-label': string;
  tone?: 'default' | 'destructive';
  children: ReactNode;
}

export function IconButton({ children, ...rest }: IconButtonProps) {
  return (
    <IconButtonBase type="button" {...rest}>
      {children}
    </IconButtonBase>
  );
}
