import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { api } from "../api/client.ts";
import { TextField } from "../components/TextField.tsx";
import { useSession } from "../hooks/useSession.tsx";

export function LoginPage() {
  const { setUser } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await setUser(await api.login(email, password));
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't log you in");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold text-slate-900">Log in</h1>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <TextField id="email" label="UNB email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-800 disabled:opacity-60"
        >
          {busy ? "Logging in..." : "Log in"}
        </button>
        <p className="text-center text-sm text-slate-600">
          New here?{" "}
          <Link to="/signup" className="font-medium text-teal-800 hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
