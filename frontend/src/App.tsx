import type { ReactNode } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { Layout } from "./components/Layout.tsx";
import { SessionProvider, useSession } from "./hooks/useSession.tsx";
import { AuditPage } from "./pages/AuditPage.tsx";
import { ConfirmPage } from "./pages/ConfirmPage.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { SetupPage } from "./pages/SetupPage.tsx";
import { SignupPage } from "./pages/SignupPage.tsx";
import { TranscriptPage } from "./pages/TranscriptPage.tsx";

function RequireStudent({ children }: { children: ReactNode }) {
  const { student, loading, error } = useSession();
  if (loading) return <p className="text-slate-600">Loading...</p>;
  if (error) return <p role="alert" className="text-red-700">{error}</p>;
  return student ? children : <Navigate to="/" replace />;
}

// login and signup pages send logged-in users home
function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  if (loading) return <p className="text-slate-600">Loading...</p>;
  return user ? <Navigate to="/" replace /> : children;
}

function Home() {
  const { user, student, loading, error } = useSession();
  if (loading) return <p className="text-slate-600">Loading...</p>;
  if (error) return <p role="alert" className="text-red-700">{error}</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!student) return <SetupPage />;
  // New profiles start by entering courses; returning students see their audit.
  return <Navigate to={student.attempts.length === 0 ? "/transcript" : "/audit"} replace />;
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
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
