import { Navigate, type RouteObject } from 'react-router';
import { RequireAuth } from '@/auth/RequireAuth';
import { SignInPage } from '@/auth/SignInPage';
import { AppShell, type RouteHandle } from '@/components/AppShell';
import { CapturePage } from '@/features/capture/CapturePage';
import { TodayPage } from '@/features/dashboard/TodayPage';
import { WeekPage } from '@/features/dashboard/WeekPage';
import { HistoryList } from '@/features/meals/HistoryList';
import { MealDetailPage } from '@/features/meals/MealDetailPage';
import { SettingsPage } from '@/features/meals/SettingsPage';
import { ReviewPage } from '@/features/review/ReviewPage';
import { ChatPage } from '@/features/suggestions/ChatPage';
import { SuggestionsPage } from '@/features/suggestions/SuggestionsPage';

const h = (handle: RouteHandle) => handle;

/** Routes table: docs/07-engineering/repo-structure.md#frontend-routes */
export const routes: RouteObject[] = [
  { path: '/sign-in', element: <SignInPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <TodayPage />, handle: h({ title: 'Today' }) },
      { path: 'week', element: <WeekPage />, handle: h({ title: 'This week', back: true }) },
      { path: 'log', element: <CapturePage />, handle: h({ title: 'Log a meal' }) },
      {
        path: 'meals/:id/review',
        element: <ReviewPage />,
        handle: h({ title: 'Review meal', back: true }),
      },
      { path: 'meals/:id', element: <MealDetailPage />, handle: h({ title: 'Meal', back: true }) },
      { path: 'history', element: <HistoryList />, handle: h({ title: 'History' }) },
      { path: 'suggestions', element: <SuggestionsPage />, handle: h({ title: 'Suggestions' }) },
      { path: 'chat', element: <ChatPage />, handle: h({ title: 'Chat', back: true }) },
      { path: 'settings', element: <SettingsPage />, handle: h({ title: 'Settings', back: true }) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
