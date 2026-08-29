# Architecture Recommendation (verified August 2026)

Stack: **React 19 + TypeScript + Vite 8 + Emotion 11 + Zustand + React Router 8 + Recharts 3 + Vitest 4**

Node: Vite 8.2.2 requires Node `^20.19.0 || >=22.12.0`. Machine has Node 24.19.0 — OK.

## 1. Exact package versions (verified against registry.npmjs.org, 2026-08-28)

**dependencies**
| Package | Version |
|---|---|
| react | 19.2.8 |
| react-dom | 19.2.8 |
| @emotion/react | 11.14.0 |
| @emotion/styled | 11.14.1 |
| zustand | 5.0.15 |
| react-router | 8.3.1 |
| recharts | 3.10.1 |

**devDependencies**
| Package | Version |
|---|---|
| typescript | 7.0.2 |
| vite | 8.2.2 |
| @vitejs/plugin-react | 6.1.1 |
| @types/react | 19.2.18 |
| @types/react-dom | 19.2.5 |
| vitest | 4.1.11 |
| @testing-library/react | 16.3.3 |
| @testing-library/dom | ^10.x (required peer of RTL 16) |
| @testing-library/jest-dom | 7.0.1 |
| @testing-library/user-event | 14.6.6 |
| jsdom | 30.0.1 |

Peer compat verified: react-router 8.3.1 requires react >=19.2.7; recharts 3.10.1 peers ^19.0.0; vitest 4.1.11 peers vite ^6||^7||^8; RTL 16.3.3 peers react ^18||^19. TypeScript 7.0.2 is current stable (Go-native tsc, drop-in for `tsc --noEmit`; 6.x is the fallback if tooling rejects it).

## 2. Critical gotcha: @vitejs/plugin-react v6 dropped Babel

Vite 8 ships Rolldown; plugin-react v6 replaced Babel with Oxc — **the `babel: {...}` option no longer exists**. Do NOT follow pre-2026 Emotion tutorials that configure `@emotion/babel-plugin` through it.

The Emotion `css` prop does NOT need the Babel plugin: set `jsxImportSource: '@emotion/react'` (tsconfig + plugin option) and the automatic JSX runtime handles it. You lose only: readable class-name labels, CSS sourcemaps, components-as-selectors. **Skip the Babel plugin.** (If ever wanted: add `@rolldown/plugin-babel` + `@babel/core` + `@emotion/babel-plugin` as a separate plugin BEFORE `react()`.)

## 3. Config files

### vite.config.ts
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({ jsxImportSource: '@emotion/react' }),
  ],
  // GitHub Pages: base must match repo name (see deploy-pipeline.md)
  base: '/Fitness-track/',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
```

### tsconfig.app.json (load-bearing options)
```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "@emotion/react",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"],
    "paths": { "@/*": ["./src/*"] },
    "baseUrl": "."
  },
  "include": ["src"]
}
```

### src/emotion.d.ts — theme typing via declaration merging
```ts
import '@emotion/react';

declare module '@emotion/react' {
  export interface Theme {
    // extend with the design-system tokens from product-design-spec.md
    colors: Record<string, string>;
    spacing: (factor: number) => string;
    radii: { sm: string; md: string; lg: string };
    typography: { fontFamily: string; fontFamilyDisplay: string; fontSizeBase: string };
  }
}
```
This types `theme` in styled interpolations, css prop function form, and `useTheme()`.

### main.tsx pattern
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, Global, css } from '@emotion/react';
import { RouterProvider } from 'react-router';
```
ThemeProvider + Global styles + RouterProvider.

### src/test/setup.ts
```ts
import '@testing-library/jest-dom/vitest';
```

## 4. Folder structure: features-based

```
src/
  app/            # composition root: router.tsx, App.tsx, layouts/
  components/     # shared dumb UI (Button, Card, Input, PageHeader)
  features/
    <feature>/    # components/, hooks/, store slice, types.ts per feature
  stores/         # zustand store creation + persist wiring
  lib/            # date utils, formatting, localStorage helpers, domain logic
  theme.ts
  emotion.d.ts
  main.tsx
  test/setup.ts
```
Rule: "shared until proven feature-specific, feature-local by default." Co-locate tests as `*.test.tsx`.

## 5. State: Zustand 5 + persist

Client-owned, frequently-written, reload-surviving state = Zustand's sweet spot. `persist` middleware, `partialize` for transient UI state, `version`/`migrate` for schema evolution. ~1 KB, `useSyncExternalStore` native (React 19-safe), no Provider, selector-based re-renders.

**Project-specific note:** this app must persist to the LEGACY localStorage keys (`gymlog_gymlog:entries` etc. — see migration-spec.md), so use a custom storage adapter or explicit read/write helpers in `lib/storage.ts` rather than default persist naming.

## 6. Routing: react-router 8.3.1 (data mode)

Import from unified `react-router` package — **never install `react-router-dom`** (dead; causes duplicate-context bugs). Use `createBrowserRouter` + `RouterProvider` with `basename: import.meta.env.BASE_URL` (or `createHashRouter` for GitHub Pages without 404 fallback).

## 7. Charting: Recharts 3.10.1

React 19 peer-verified, own TS types, declarative composition, `accessibilityLayer`. Caveats: `ResponsiveContainer` needs a parent with explicit height; in jsdom charts render 0×0 — test data transforms, not SVG output.

## 8. Testing: Vitest 4 + Testing Library

Vitest reuses the Vite pipeline so the Emotion transform applies in tests. Install `@testing-library/dom` explicitly. Scripts: `"test": "vitest"`, `"test:run": "vitest run"`, `"typecheck": "tsc -b --noEmit"`. Wrap renders in ThemeProvider (`renderWithTheme` helper in `src/test/`). Reset Zustand + `localStorage.clear()` between tests.

## 9. Gotchas checklist

1. `react({ babel: ... })` gone in plugin-react v6 (see §2).
2. Don't mix JSX runtimes — no per-file `/** @jsxImportSource */` pragmas once set globally.
3. Emotion 11.14.0 is the React 19 support release; don't let resolver pin older (11.13.x warns under React 19).
4. React 19 StrictMode double-invokes renders; Emotion 11.14 is safe (useInsertionEffect) — but don't create serialized styles in module scope keyed on props.
5. Hashed-only class names without Babel plugin — cosmetic, acceptable.
6. Windows: keep repo out of OneDrive-synced folders; watch import-path casing (NTFS forgives, Linux CI doesn't).
7. `react-router-dom` is dead — v7+ unified into `react-router`.
8. Vitest+Emotion Babel bug (vitest #7746) is moot when Babel-less.
