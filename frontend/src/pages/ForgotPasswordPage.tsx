import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { MailCheck } from "lucide-react";
import { api } from "../api/client.ts";
import { TextField } from "../components/TextField.tsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't send the link");
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
            If <span className="font-medium text-foreground">{email}</span> has an account, we sent it a link to choose a new password. It
            works for 1 hour.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Forgot your password?</CardTitle>
        <CardDescription>We&apos;ll email you a link to choose a new one.</CardDescription>
      </CardHeader>
      <form onSubmit={submit}>
        <CardContent className="grid gap-4">
          <TextField id="email" label="UNB email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="mt-6 flex-col gap-3 border-t pt-6 pb-6">
          <Button type="submit" disabled={busy} className="h-10 w-full">
            {busy ? "Sending..." : "Send reset link"}
          </Button>
          <Link to="/login" className="text-sm font-medium text-primary hover:underline">
            Back to log in
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
