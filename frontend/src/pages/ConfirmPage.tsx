import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { api } from "../api/client.ts";
import { useSession } from "../hooks/useSession.tsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Opened from the signup email. The account is only created when the button is pressed,
// because UNB's mail scanner opens links in emails before the student does.
export function ConfirmPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { setUser } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await setUser(await api.confirm(token));
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't confirm your account");
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto max-w-md text-center">
      <CardHeader>
        <CardTitle className="text-xl">Confirm your account</CardTitle>
        <CardDescription>One click and you&apos;re in.</CardDescription>
      </CardHeader>
      <CardContent>
        {!token ? (
          <p role="alert" className="text-sm text-destructive">
            This link is missing its code. Copy the whole link from the email, including everything after <code>token=</code>.
          </p>
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Sign up again
            </Link>
          </p>
        ) : (
          <Button onClick={() => void confirm()} disabled={busy} className="h-10 px-6">
            {busy ? "Confirming..." : "Confirm"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
