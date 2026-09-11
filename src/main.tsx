import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Global, ThemeProvider } from '@emotion/react';
import { RouterProvider } from 'react-router';
import { router } from './app/router';
import { globalStyles } from './app/globalStyles';
import { resolveTheme, themeFor, useSystemPrefersDark } from './theme';
import { runStartupMigrations, useSettingsStore } from './stores';
import { registerServiceWorker } from './lib/registerServiceWorker';

runStartupMigrations();
registerServiceWorker();

function App() {
  const themePref = useSettingsStore((s) => s.themePref);
  // subscribing keeps `system` mode reactive to OS changes
  useSystemPrefersDark();
  const theme = themeFor(resolveTheme(themePref));
  return (
    <ThemeProvider theme={theme}>
      <Global styles={globalStyles(theme)} />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
