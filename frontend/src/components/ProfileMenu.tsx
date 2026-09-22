import { useState } from "react";
import { useNavigate } from "react-router";
import { termLabel } from "backend/engine/terms";
import { api, type Student, type User } from "../api/client.ts";
import { useSession } from "../hooks/useSession.tsx";
import { DesignationFields } from "./DesignationFields.tsx";

// The account, Honours and Cybersecurity choices (once there's a profile), and logging out.
export function ProfileMenu({ user, student }: { user: User; student: Student | null }) {
  const { setStudent, logout } = useSession();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (designations: string[]) => {
    setSaving(true);
    setError(null);
    try {
      setStudent(await api.updateDesignations(designations));
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const logOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">Profile</summary>
      <div className="absolute right-0 z-10 mt-2 w-72 space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
        <p className="truncate text-sm font-medium text-slate-900">{user.name ?? user.email}</p>
        <p className="text-xs text-slate-600">
          Student number {user.studentNumber}
          {user.verified ? (
            <span className="ml-1 font-medium text-teal-800">· verified</span>
          ) : (
            <span className="block text-amber-800">Not verified yet. Import your transcript to verify it.</span>
          )}
        </p>
        {student && (
          <>
            <p className="text-xs text-slate-600">BCS, started {termLabel(student.program.entry)}</p>
            <DesignationFields value={student.designations} onChange={(d) => void save(d)} disabled={saving} />
          </>
        )}
        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}
        <button onClick={() => void logOut()} className="w-full border-t border-slate-100 pt-2 text-left text-sm font-medium text-slate-700 hover:text-slate-900">
          Log out
        </button>
      </div>
    </details>
  );
}
