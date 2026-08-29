import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import type { ReactElement, ReactNode } from 'react';
import { lightTheme, darkTheme } from '@/theme';
import type { AppTheme } from '@/theme';

export interface RenderWithThemeOptions extends Omit<RenderOptions, 'wrapper'> {
  theme?: AppTheme;
}

/** Render wrapped in the Emotion ThemeProvider (default: light theme). */
export function renderWithTheme(ui: ReactElement, { theme = lightTheme, ...options }: RenderWithThemeOptions = {}): RenderResult {
  const Wrapper = ({ children }: { children: ReactNode }) => <ThemeProvider theme={theme}>{children}</ThemeProvider>;
  return render(ui, { wrapper: Wrapper, ...options });
}

export { lightTheme, darkTheme };
