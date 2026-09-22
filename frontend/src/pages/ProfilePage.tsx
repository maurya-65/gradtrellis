import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { BadgeCheck, CircleAlert, CircleUserRound, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { termLabel } from "backend/engine/terms";
import { api, type User } from "../api/client.ts";
import { DesignationFields } from "../components/DesignationFields.tsx";
import { TextField } from "../components/TextField.tsx";
import { useSession } from "../hooks/useSession.tsx";
import { getTheme, setTheme, type Theme } from "../lib/theme.ts";
import { Badge } from "@/components/ui/badge";
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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{user.name}</h1>
            {user.verified ? (
              <Badge variant="outline" className="text-complete">
                <BadgeCheck />
                Verified
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                <CircleAlert />
                Unverified
              </Badge>
            )}
          </div>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <p className="text-sm text-muted-foreground">Student number {user.studentNumber}</p>
          {!user.verified && (
            <p className="text-sm text-muted-foreground">
              Import your transcript on the{" "}
              <Link to="/transcript" className="font-medium text-primary hover:underline">
                Transcript
              </Link>{" "}
              page to verify your account.
            </p>
          )}
        </div>
      </div>

      <NameCard user={user} />
      {!user.suspended && <DegreeCard />}
      <PasswordCard />
      <AppearanceCard />

      <Button variant="outline" onClick={() => void logOut()} className="h-10 justify-self-start">
        <LogOut />
        Log out
      </Button>
    </div>
  );
}

function NameCard({ user }: { user: User }) {
  const { setUser } = useSession();
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateName(value);
      setName(updated.name);
      await setUser(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't save your name");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void save(name);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Name</CardTitle>
        <CardDescription>
          {user.transcriptName
            ? `It has to match your transcript: ${user.transcriptName}.`
            : "As on your UNB records. It's checked against your transcript when you verify your account."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <TextField id="name" label="Full name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || name.trim() === user.name} className="h-10">
              {busy ? "Saving..." : "Save name"}
            </Button>
            {user.nameDeadline && user.transcriptName && (
              <Button type="button" variant="outline" disabled={busy} onClick={() => void save(user.transcriptName!)} className="h-10">
                Use {user.transcriptName}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
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
