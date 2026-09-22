import type { ReactNode } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { Layout } from "./components/Layout.tsx";
import { StudentProvider, useStudent } from "./hooks/useStudent.tsx";
import { AuditPage } from "./pages/AuditPage.tsx";
import { SetupPage } from "./pages/SetupPage.tsx";
import { TranscriptPage } from "./pages/TranscriptPage.tsx";

function RequireStudent({ children }: { children: ReactNode }) {
  const { student, loading, error } = useStudent();
  if (loading) return <p className="text-slate-600">Loading...</p>;
  if (error) return <p role="alert" className="text-red-700">{error}</p>;
  return student ? children : <Navigate to="/" replace />;
}

function Home() {
  const { student, loading } = useStudent();
  if (loading) return <p className="text-slate-600">Loading...</p>;
  if (!student) return <SetupPage />;
  // New profiles start by entering courses; returning students see their audit.
  return <Navigate to={student.attempts.length === 0 ? "/transcript" : "/audit"} replace />;
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/transcript", element: <RequireStudent><TranscriptPage /></RequireStudent> },
      { path: "/audit", element: <RequireStudent><AuditPage /></RequireStudent> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return (
    <StudentProvider>
      <RouterProvider router={router} />
    </StudentProvider>
  );
}
