import { Link, NavLink, Outlet } from "react-router";
import { useSession } from "../hooks/useSession.tsx";
import { Wordmark } from "./Logo.tsx";
import { ProfileMenu } from "./ProfileMenu.tsx";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function NavButton({ to, children }: { to: string; children: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "secondary" : "ghost" }), "h-9 px-3")}>
      {children}
    </NavLink>
  );
}

export function Layout() {
  const { user, student } = useSession();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <Link to="/">
            <Wordmark />
          </Link>
          {user ? (
            <nav aria-label="Main" className="flex items-center gap-1">
              {student && (
                <>
                  <NavButton to="/transcript">Transcript</NavButton>
                  <NavButton to="/audit">Degree audit</NavButton>
                </>
              )}
              <ProfileMenu user={user} />
            </nav>
          ) : (
            <nav aria-label="Account" className="flex items-center gap-2">
              <Button asChild variant="ghost" className="h-9 px-3">
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild className="h-9 px-3">
                <Link to="/signup">Sign up</Link>
              </Button>
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <Outlet />
      </main>

      <footer className="border-t">
        <p className="mx-auto max-w-5xl px-4 py-6 text-xs text-muted-foreground">
          GradTrellis is an independent student project, not affiliated with the University of New Brunswick. The Undergraduate
          Calendar and your Faculty advisor are the authority on degree requirements.
        </p>
      </footer>
    </div>
  );
}
