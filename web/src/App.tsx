import { Outlet, RouterProvider, createBrowserRouter, useRouteError } from 'react-router';
import { AppShell } from './components/AppShell';
import { ConfirmHost } from './components/ConfirmHost';
import { Toaster } from './components/Toaster';
import { BundlePage } from './pages/BundlePage';
import { ChapterPage } from './pages/ChapterPage';
import { DeckPage } from './pages/DeckPage';
import { FlashcardsPage } from './pages/FlashcardsPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NewDeckPage } from './pages/NewDeckPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { NotePage } from './pages/NotePage';
import { SettingsPage } from './pages/SettingsPage';
import { SubjectPage } from './pages/SubjectPage';
import { SubjectSettingsPage } from './pages/SubjectSettingsPage';
import { VisualizationPage } from './pages/VisualizationPage';
import { VisualizationsPage } from './pages/VisualizationsPage';

function Root() {
  return (
    <>
      <Outlet />
      <Toaster />
      <ConfirmHost />
    </>
  );
}

/** Uventet feil under visningen: norsk melding i stedet for standardsiden til react-router. */
function RouteError() {
  const error = useRouteError();
  console.error(error);
  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="page-title">Noe gikk galt</h1>
        <p className="muted">En feil stoppet visningen av denne siden. Notatene og kortene dine er ikke berørt.</p>
        <p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Last inn på nytt
          </button>
        </p>
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
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
          { path: 'fag/:subjectId/visualiseringer', element: <VisualizationsPage /> },
          { path: 'fag/:subjectId/visualiseringer/:vizKey', element: <VisualizationPage /> },
          { path: 'fag/:subjectId/flashcards', element: <FlashcardsPage /> },
          { path: 'fag/:subjectId/flashcards/ny', element: <NewDeckPage /> },
          { path: 'fag/:subjectId/flashcards/:deckId', element: <DeckPage /> },
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
