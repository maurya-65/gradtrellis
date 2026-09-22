import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { BadgeCheck, CircleUserRound, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { termLabel } from "backend/engine/terms";
import { api } from "../api/client.ts";
import { DesignationFields } from "../components/DesignationFields.tsx";
import { displayName } from "../components/ProfileMenu.tsx";
import { TextField } from "../components/TextField.tsx";
import { useSession } from "../hooks/useSession.tsx";
import { getTheme, setTheme, type Theme } from "../lib/theme.ts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ProfilePage() {
  const { user, logout } = useSession();
  const navigate = useNavigate();
  if (!user) return null;

  const logOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div className="flex items-center gap-4">
        <CircleUserRound className="size-16 shrink-0 text-muted-foreground" strokeWidth={1.25} aria-hidden />
        <div className="grid min-w-0 gap-0.5">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{displayName(user) ?? "Your profile"}</h1>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            Student number {user.studentNumber}
            {user.verified ? (
              <BadgeCheck className="size-4 text-complete" aria-label="verified" />
            ) : (
              <span>· import your transcript to verify it</span>
            )}
          </p>
        </div>
      </div>

      <DegreeCard />
      <PasswordCard />
      <AppearanceCard />

      <Button variant="outline" onClick={() => void logOut()} className="h-10 justify-self-start">
        <LogOut />
        Log out
      </Button>
    </div>
  );
}

function DegreeCard() {
  const { student, setStudent } = useSession();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (designations: string[]) => {
    setSaving(true);
    setError(null);
    try {
      setStudent(await api.updateDesignations(designations));
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't save that");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Degree</CardTitle>
        <CardDescription>
          {student ? `Bachelor of Computer Science, started ${termLabel(student.program.entry)}.` : "You haven't set up your degree yet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {student ? (
          <>
            <DesignationFields value={student.designations} onChange={(d) => void save(d)} disabled={saving} />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </>
        ) : (
          <Button asChild className="h-10 justify-self-start">
            <Link to="/setup">Set up your degree</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await api.changePassword(current, next);
      setCurrent("");
      setNext("");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't change your password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>Changing it logs you out on your other devices.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <TextField
            id="current-password"
            label="Current password"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <TextField
            id="new-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            hint="At least 8 characters."
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {done && <p className="text-sm text-complete">Password changed.</p>}
          <Button type="submit" disabled={busy} className="h-10 justify-self-start">
            {busy ? "Saving..." : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const THEMES: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function AppearanceCard() {
  const [theme, setThemeState] = useState(getTheme);

  const choose = (t: Theme) => {
    setTheme(t);
    setThemeState(t);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>System follows your device&apos;s setting. Saved on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label="Theme" className="inline-flex gap-1 rounded-lg bg-muted p-1">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => choose(value)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                theme === value ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
