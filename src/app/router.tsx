import { createBrowserRouter } from 'react-router';
import { AppLayout } from './layouts/AppLayout';

/**
 * Routes are LAZY. Each page becomes its own chunk, so first paint parses and
 * executes only the route you landed on instead of all five — Progress alone
 * pulls Recharts, and Train pulls dnd-kit.
 *
 * `lazy` rather than React.lazy + Suspense on purpose: with a data router the
 * navigation itself stays pending until the chunk resolves, so the page you are
 * leaving stays on screen and nothing flashes a skeleton over the destination.
 * `AppLayout` reads `useNavigation()` to show that the tap registered.
 *
 * NOTE: the chunks these produce are precached by `public/sw.js`, which learns
 * their hashed names from the JSON block `vite-plugin-sw-precache.ts` injects
 * into index.html. Without that, a route you had never opened online would 503
 * offline — see docs/HANDOFF.md gap #9. The exercise library stays lazy because
 * it is a DYNAMIC import of a route chunk, and the plugin follows only static
 * imports.
 */
export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppLayout />,
      children: [
        {
          index: true,
          lazy: async () => ({ Component: (await import('@/features/today/TodayPage')).TodayPage }),
        },
        {
          path: 'train',
          lazy: async () => ({ Component: (await import('@/features/train/TrainPage')).TrainPage }),
        },
        {
          path: 'calendar',
          lazy: async () => ({
            Component: (await import('@/features/calendar/CalendarPage')).CalendarPage,
          }),
        },
        {
          path: 'progress',
          lazy: async () => ({
            Component: (await import('@/features/progress/ProgressPage')).ProgressPage,
          }),
        },
        {
          path: 'more',
          lazy: async () => ({ Component: (await import('@/features/more/MorePage')).MorePage }),
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
