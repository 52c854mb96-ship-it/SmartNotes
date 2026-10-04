import { Outlet, RouterProvider, createBrowserRouter } from 'react-router';
import { AppShell } from './components/AppShell';
import { ConfirmHost } from './components/ConfirmHost';
import { Toaster } from './components/Toaster';
import { BundlePage } from './pages/BundlePage';
import { ChapterPage } from './pages/ChapterPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { NotePage } from './pages/NotePage';
import { SettingsPage } from './pages/SettingsPage';
import { SubjectPage } from './pages/SubjectPage';
import { SubjectSettingsPage } from './pages/SubjectSettingsPage';

function Root() {
  return (
    <>
      <Outlet />
      <Toaster />
      <ConfirmHost />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/logg-inn', element: <LoginPage /> },
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'fag/:subjectId', element: <SubjectPage /> },
          { path: 'fag/:subjectId/innstillinger', element: <SubjectSettingsPage /> },
          { path: 'fag/:subjectId/pdf', element: <BundlePage /> },
          { path: 'fag/:subjectId/kapittel/:chapterId', element: <ChapterPage /> },
          { path: 'fag/:subjectId/kapittel/:chapterId/pdf', element: <BundlePage /> },
          { path: 'notat/:noteId', element: <NotePage /> },
          { path: 'innstillinger', element: <SettingsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
