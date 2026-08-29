import '@emotion/react';
import type { AppTheme } from './theme';

declare module '@emotion/react' {
  // Declaration merging: `theme` in styled interpolations, css prop function
  // form and useTheme() is now the full app token set.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface Theme extends AppTheme {}
}
