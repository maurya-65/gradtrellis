import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { MailCheck } from "lucide-react";
import { api } from "../api/client.ts";
import { TextField } from "../components/TextField.tsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function SignupPage() {
  const [email, setEmail] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.signup({ email, studentNumber, password });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't sign you up");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardHeader className="justify-items-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <MailCheck className="size-6" />
          </span>
          <CardTitle className="text-xl">Check your UNB inbox</CardTitle>
          <CardDescription>
            We sent a link to <span className="font-medium text-foreground">{email}</span>. Open it and press Confirm to finish creating
            your account. It works for 24 hours.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="mx-auto grid max-w-md gap-8">
      <div className="grid gap-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">Know exactly where you stand in your CS degree</h1>
        <p className="text-muted-foreground text-balance">
          See which Bachelor of Computer Science requirements you&apos;ve met, what&apos;s in progress and what&apos;s left, using the
          calendar for the year you started.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>Use your UNB email; we&apos;ll send a link to confirm it.</CardDescription>
        </CardHeader>
        <form onSubmit={submit}>
          <CardContent className="grid gap-4">
            <TextField id="email" label="UNB email" type="email" autoComplete="email" placeholder="you@unb.ca" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField
              id="student-number"
              label="Student number"
              inputMode="numeric"
              placeholder="7 digits"
              hint="Verified later from your transcript."
              required
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
            />
            <TextField
              id="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              hint="At least 8 characters."
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </CardContent>
          <CardFooter className="mt-6 flex-col gap-3 border-t pt-6 pb-6">
            <Button type="submit" disabled={busy} className="h-10 w-full">
              {busy ? "Creating account..." : "Create account"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Log in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
