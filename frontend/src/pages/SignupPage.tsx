import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { api } from "../api/client.ts";
import { TextField } from "../components/TextField.tsx";

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
      <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Check your UNB inbox</h1>
        <p className="mt-2 text-sm text-slate-700">
          We sent a link to <span className="font-medium">{email}</span>. Open it and press Confirm to finish creating your account. It
          works for 24 hours.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold text-slate-900">Plan your UNB Computer Science degree</h1>
      <p className="mt-2 text-slate-700">
        See which Bachelor of Computer Science requirements you've met, what's in progress and what's left, using the calendar for the
        year you started.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <TextField id="email" label="UNB email" type="email" autoComplete="email" placeholder="you@unb.ca" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField
          id="student-number"
          label="Student number"
          inputMode="numeric"
          placeholder="3xxxxxx"
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
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-800 disabled:opacity-60"
        >
          {busy ? "Signing up..." : "Create account"}
        </button>
        <p className="text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-teal-800 hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
