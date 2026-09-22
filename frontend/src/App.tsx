import type { ReactNode } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { Layout } from "./components/Layout.tsx";
import { SessionProvider, useSession } from "./hooks/useSession.tsx";
import { AuditPage } from "./pages/AuditPage.tsx";
import { ConfirmPage } from "./pages/ConfirmPage.tsx";
import { LandingPage } from "./pages/LandingPage.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { SetupPage } from "./pages/SetupPage.tsx";
import { SignupPage } from "./pages/SignupPage.tsx";
import { TranscriptPage } from "./pages/TranscriptPage.tsx";

function RequireStudent({ children }: { children: ReactNode }) {
  const { student, loading, error } = useSession();
  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (error) return <p role="alert" className="text-destructive">{error}</p>;
  return student ? children : <Navigate to="/" replace />;
}

// login and signup pages send logged-in users home
function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  return user ? <Navigate to="/" replace /> : children;
}

// logged-in users without a profile yet
function NeedsSetup({ children }: { children: ReactNode }) {
  const { user, student, loading } = useSession();
  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  return user && !student ? children : <Navigate to="/" replace />;
}

// Guests get the landing page; everyone else is sent to where they left off.
function Home() {
  const { user, student, loading } = useSession();
  if (loading) return null;
  if (!user) return <LandingPage />;
  if (!student) return <Navigate to="/setup" replace />;
  // New profiles start by entering courses; returning students see their audit.
  return <Navigate to={student.attempts.length === 0 ? "/transcript" : "/audit"} replace />;
}

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  {
    element: <Layout />,
    children: [
      { path: "/setup", element: <NeedsSetup><SetupPage /></NeedsSetup> },
      { path: "/login", element: <GuestOnly><LoginPage /></GuestOnly> },
      { path: "/signup", element: <GuestOnly><SignupPage /></GuestOnly> },
      { path: "/confirm", element: <ConfirmPage /> },
      { path: "/transcript", element: <RequireStudent><TranscriptPage /></RequireStudent> },
      { path: "/audit", element: <RequireStudent><AuditPage /></RequireStudent> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return (
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  );
}
