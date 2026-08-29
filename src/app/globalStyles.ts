import { css, type Theme } from '@emotion/react';

/**
 * Global styles: box-sizing reset, 100dvh min-height, visible focus rings,
 * ::selection, and the prefers-reduced-motion global override that gates
 * ALL animation.
 */
export const globalStyles = (theme: Theme) => css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html {
    -webkit-text-size-adjust: 100%;
  }

  body {
    margin: 0;
    min-height: 100dvh;
    background: ${theme.colors.background};
    color: ${theme.colors.foreground};
    font-family: ${theme.typography.body};
    font-size: ${theme.typography.fontSizes.md};
    line-height: ${theme.typography.lineHeight};
    -webkit-font-smoothing: antialiased;
  }

  #root {
    min-height: 100dvh;
  }

  h1,
  h2,
  h3,
  h4 {
    font-family: ${theme.typography.display};
  }

  :focus-visible {
    outline: 3px solid ${theme.colors.ring};
    outline-offset: 2px;
  }

  ::selection {
    background: ${theme.colors.primary};
    color: ${theme.colors.onPrimary};
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;
