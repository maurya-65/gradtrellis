import { useState } from "react";
import { termLabel } from "backend/engine/terms";
import { api, type Student } from "../api/client.ts";
import { useStudent } from "../hooks/useStudent.tsx";
import { DesignationFields } from "./DesignationFields.tsx";

// Lets students change Honours and Cybersecurity after setup.
export function ProfileMenu({ student }: { student: Student }) {
  const { setStudent } = useStudent();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (designations: string[]) => {
    setSaving(true);
    setError(null);
    try {
      setStudent(await api.updateDesignations(student.id, designations));
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">Profile</summary>
      <div className="absolute right-0 z-10 mt-2 w-72 space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
        <p className="text-xs text-slate-600">BCS, started {termLabel(student.program.entry)}</p>
        <DesignationFields value={student.designations} onChange={(d) => void save(d)} disabled={saving} />
        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
