import { useMemo } from "react";
import { Link } from "react-router";
import { api, type StoredAttempt } from "../api/client.ts";
import { AddCourseForm } from "../components/AddCourseForm.tsx";
import { ImportTranscript } from "../components/ImportTranscript.tsx";
import { TermTable } from "../components/TermTable.tsx";
import { compareTerms, termLabel } from "backend/engine/terms";
import { useStudent } from "../hooks/useStudent.tsx";

export function TranscriptPage() {
  const { student, refresh } = useStudent();

  const byTerm = useMemo(() => {
    const groups = new Map<string, { label: string; term: StoredAttempt["term"]; attempts: StoredAttempt[] }>();
    for (const a of student?.attempts ?? []) {
      const label = termLabel(a.term);
      const g = groups.get(label) ?? { label, term: a.term, attempts: [] };
      g.attempts.push(a);
      groups.set(label, g);
    }
    return [...groups.values()].sort((a, b) => compareTerms(b.term, a.term));
  }, [student]);

  if (!student) return null;

  const remove = async (a: StoredAttempt) => {
    await api.deleteAttempt(student.id, a.id);
    await refresh();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Your transcript</h1>
          <p className="mt-1 text-sm text-slate-700">
            Add every course you've taken or are taking, including repeats and withdrawals. Started {termLabel(student.program.entry)}.
          </p>
        </div>
        <Link to="/audit" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800">
          View degree audit
        </Link>
      </div>

      <ImportTranscript student={student} />

      <AddCourseForm student={student} onAdded={refresh} />

      {byTerm.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">No courses yet. Start with your first term.</p>
      ) : (
        <div className="space-y-6">
          {byTerm.map((g) => (
            <TermTable key={g.label} label={g.label} attempts={g.attempts} onRemove={(a) => void remove(a)} />
          ))}
        </div>
      )}
    </div>
  );
}
