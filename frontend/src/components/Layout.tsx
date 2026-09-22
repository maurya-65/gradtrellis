import { NavLink, Outlet, useLocation } from "react-router";
import { useSession } from "../hooks/useSession.tsx";
import { ProfileMenu } from "./ProfileMenu.tsx";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-slate-200"
  }`;

export function Layout() {
  const { user, student } = useSession();
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            GradTrellis
          </NavLink>
          {user ? (
            <nav aria-label="Main" className="flex gap-1">
              {student && (
                <>
                  <NavLink to="/transcript" className={navClass}>
                    Transcript
                  </NavLink>
                  <NavLink to="/audit" className={navClass}>
                    Degree audit
                  </NavLink>
                </>
              )}
              {/* keyed by page so the menu closes on navigation */}
              <ProfileMenu key={pathname} user={user} student={student} />
            </nav>
          ) : (
            <nav aria-label="Account" className="flex gap-1">
              <NavLink to="/login" className={navClass}>
                Log in
              </NavLink>
              <NavLink to="/signup" className={navClass}>
                Sign up
              </NavLink>
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <p className="mx-auto max-w-5xl px-4 py-4 text-xs text-slate-600">
          GradTrellis is an independent student project, not affiliated with the University of New Brunswick. The
          Undergraduate Calendar and your Faculty advisor are the authority on degree requirements.
        </p>
      </footer>
    </div>
  );
}
