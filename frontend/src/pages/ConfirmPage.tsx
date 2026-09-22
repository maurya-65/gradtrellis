import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { api } from "../api/client.ts";
import { useSession } from "../hooks/useSession.tsx";

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
    <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Confirm your account</h1>
      <p className="mt-2 text-sm text-slate-700">One click and you're in.</p>
      {!token ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          This link is missing its code. Copy the whole link from the email, including everything after <code>token=</code>.
        </p>
      ) : error ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}{" "}
          <Link to="/signup" className="font-medium text-teal-800 hover:underline">
            Sign up again
          </Link>
        </p>
      ) : (
        <button
          onClick={() => void confirm()}
          disabled={busy}
          className="mt-5 rounded-md bg-teal-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-800 disabled:opacity-60"
        >
          {busy ? "Confirming..." : "Confirm"}
        </button>
      )}
    </div>
  );
}
