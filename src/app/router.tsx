import { createBrowserRouter } from 'react-router';
import { AppLayout } from './layouts/AppLayout';
import { TodayPage } from '@/features/today/TodayPage';
import { TrainPage } from '@/features/train/TrainPage';
import { CalendarPage } from '@/features/calendar/CalendarPage';
import { ProgressPage } from '@/features/progress/ProgressPage';
import { MorePage } from '@/features/more/MorePage';

/** basename follows Vite's base (GitHub Pages: /Fitness-track/). */
export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppLayout />,
      children: [
        { index: true, element: <TodayPage /> },
        { path: 'train', element: <TrainPage /> },
        { path: 'calendar', element: <CalendarPage /> },
        { path: 'progress', element: <ProgressPage /> },
        { path: 'more', element: <MorePage /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
