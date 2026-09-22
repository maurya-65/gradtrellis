import { useMemo } from "react";
import { Link } from "react-router";
import { api, type Result, type StoredAttempt } from "../api/client.ts";
import { AddCourseForm } from "../components/AddCourseForm.tsx";
import { ImportTranscript } from "../components/ImportTranscript.tsx";
import { TermTable } from "../components/TermTable.tsx";
import { compareTerms, termLabel } from "backend/engine/terms";
import { useSession } from "../hooks/useSession.tsx";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function TranscriptPage() {
  const { student, refresh } = useSession();

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

  const changeResult = async (a: StoredAttempt, result: Result) => {
    await api.updateAttemptResult(a.id, result);
    await refresh();
  };

  const remove = async (a: StoredAttempt) => {
    await api.deleteAttempt(a.id);
    await refresh();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your transcript</h1>
          <p className="mt-2 text-muted-foreground">
            Every course you&apos;ve taken, are taking or plan to take, including repeats and withdrawals. Started {termLabel(student.program.entry)}.
          </p>
        </div>
        <Button asChild className="h-10">
          <Link to="/audit">
            View degree audit
            <ArrowRight />
          </Link>
        </Button>
      </div>

      <ImportTranscript student={student} />

      <AddCourseForm student={student} onAdded={refresh} />

      {byTerm.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No courses yet. Import your transcript or add your first course.</p>
      ) : (
        <div className="space-y-6">
          {byTerm.map((g) => (
            <TermTable key={g.label} label={g.label} attempts={g.attempts} onChangeResult={(a, r) => void changeResult(a, r)} onRemove={(a) => void remove(a)} />
          ))}
        </div>
      )}
    </div>
  );
}
