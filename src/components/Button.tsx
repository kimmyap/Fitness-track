import styled from '@emotion/styled';
import type { Theme } from '@emotion/react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'success';

function variantStyles(theme: Theme, variant: ButtonVariant) {
  switch (variant) {
    case 'secondary':
      return {
        background: theme.colors.muted,
        color: theme.colors.foreground,
        border: `1px solid ${theme.colors.border}`,
      };
    case 'ghost':
      return {
        background: 'transparent',
        color: theme.colors.foreground,
        border: '1px solid transparent',
      };
    case 'destructive':
      return {
        background: theme.colors.destructive,
        color: theme.colors.onDestructive,
        border: '1px solid transparent',
      };
    /*
     * The design system's "completed" fill (accent / onAccent) — the same pair
     * the finished-set and PR blocks use. Light mode is a documented 3.30:1
     * exception, so this is never the only signal: callers pair it with an
     * icon and a word.
     */
    case 'success':
      return {
        background: theme.colors.accent,
        color: theme.colors.onAccent,
        border: '1px solid transparent',
      };
    case 'primary':
    default:
      return {
        background: theme.colors.primary,
        color: theme.colors.onPrimary,
        border: '1px solid transparent',
      };
  }
}

/**
 * ≥44px touch target; motion is transform/opacity only and disabled under
 * prefers-reduced-motion via the global override.
 */
export const Button = styled.button<{ variant?: ButtonVariant; fullWidth?: boolean }>`
  ${({ theme, variant = 'primary' }) => variantStyles(theme, variant)};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space[2]};
  min-height: ${({ theme }) => theme.touchTarget};
  min-width: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => `${theme.space[2]} ${theme.space[4]}`};
  width: ${({ fullWidth }) => (fullWidth ? '100%' : 'auto')};
  border-radius: ${({ theme }) => theme.radii.md};
  font-family: ${({ theme }) => theme.typography.body};
  font-size: ${({ theme }) => theme.typography.fontSizes.md};
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
  user-select: none;
  transition:
    transform ${({ theme }) => `${theme.motion.duration.fast} ${theme.motion.easing.out}`},
    opacity ${({ theme }) => `${theme.motion.duration.fast} ${theme.motion.easing.out}`};

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    opacity: 0.9;
  }
  &:active:not(:disabled) {
    transform: scale(0.97);
  }
  /*
   * Disabled switches to the muted surface rather than fading the button.
   * Opacity dims the background and the label by the same amount, so the
   * contrast between them collapses — measured 2.09:1 in dark and 1.49:1 in
   * light on a disabled primary button, which is illegible rather than merely
   * inactive. Muted-on-muted still reads as inert, and stays legible.
   *
   * The success variant is exempt: a disabled confirmation is not inert, it is
   * DONE, and repainting it muted made a logged set read as a dead button.
   * Object form rather than a nested template literal, because a backtick
   * anywhere inside this one breaks the build.
   */
  &:disabled {
    ${({ theme, variant }) =>
      variant === 'success'
        ? { cursor: 'not-allowed' }
        : {
            background: theme.colors.muted,
            color: theme.colors.mutedForeground,
            borderColor: theme.colors.border,
            cursor: 'not-allowed',
          }};
  }
`;
