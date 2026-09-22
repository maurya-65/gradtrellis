import type { ReactNode } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { Layout } from "./components/Layout.tsx";
import { SessionProvider, useSession } from "./hooks/useSession.tsx";
import { AdvisorPage } from "./pages/AdvisorPage.tsx";
import { AuditPage } from "./pages/AuditPage.tsx";
import { ConfirmPage } from "./pages/ConfirmPage.tsx";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { LandingPage } from "./pages/LandingPage.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { ProfilePage } from "./pages/ProfilePage.tsx";
import { ResetPasswordPage } from "./pages/ResetPasswordPage.tsx";
import { SetupPage } from "./pages/SetupPage.tsx";
import { SignupPage } from "./pages/SignupPage.tsx";
import { TranscriptPage } from "./pages/TranscriptPage.tsx";

// a suspended account can only fix its name in the profile
function RequireStudent({ children }: { children: ReactNode }) {
  const { user, student, loading, error } = useSession();
  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (error) return <p role="alert" className="text-destructive">{error}</p>;
  if (user?.suspended) return <Navigate to="/profile" replace />;
  return student ? children : <Navigate to="/" replace />;
}

function RequireUser({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  return user ? children : <Navigate to="/login" replace />;
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
  if (user.suspended) return <Navigate to="/profile" replace />;
  if (!student) return <Navigate to="/setup" replace />;
  return <Navigate to="/home" replace />;
}

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  {
    element: <Layout />,
    children: [
      { path: "/setup", element: <NeedsSetup><SetupPage /></NeedsSetup> },
      { path: "/login", element: <GuestOnly><LoginPage /></GuestOnly> },
      { path: "/signup", element: <GuestOnly><SignupPage /></GuestOnly> },
      { path: "/forgot-password", element: <GuestOnly><ForgotPasswordPage /></GuestOnly> },
      { path: "/confirm", element: <ConfirmPage /> },
      { path: "/reset-password", element: <ResetPasswordPage /> },
      { path: "/profile", element: <RequireUser><ProfilePage /></RequireUser> },
      { path: "/transcript", element: <RequireStudent><TranscriptPage /></RequireStudent> },
      { path: "/home", element: <RequireStudent><HomePage /></RequireStudent> },
      { path: "/advisor", element: <RequireStudent><AdvisorPage /></RequireStudent> },
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
