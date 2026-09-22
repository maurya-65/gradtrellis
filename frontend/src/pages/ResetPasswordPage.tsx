import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { api } from "../api/client.ts";
import { TextField } from "../components/TextField.tsx";
import { useSession } from "../hooks/useSession.tsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// Opened from the reset email. Choosing a password logs you in and out everywhere else.
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { setUser } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await setUser(await api.resetPassword(token, password));
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't reset your password");
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-xl">Choose a new password</CardTitle>
        </CardHeader>
        <CardContent>
          <p role="alert" className="text-sm text-destructive">
            This link is missing its code. Copy the whole link from the email, including everything after <code>token=</code>.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>You&apos;ll be logged out on your other devices.</CardDescription>
      </CardHeader>
      <form onSubmit={submit}>
        <CardContent className="grid gap-4">
          <TextField
            id="password"
            label="New password"
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
              {error}{" "}
              <Link to="/forgot-password" className="font-medium text-primary hover:underline">
                Get a new link
              </Link>
            </p>
          )}
        </CardContent>
        <CardFooter className="mt-6 border-t pt-6 pb-6">
          <Button type="submit" disabled={busy} className="h-10 w-full">
            {busy ? "Saving..." : "Save password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
