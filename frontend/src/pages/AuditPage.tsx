import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api, type AuditResult } from "../api/client.ts";
import { AuditSummary } from "../components/AuditSummary.tsx";
import { AuditWarnings } from "../components/AuditWarnings.tsx";
import { NotCountedTable } from "../components/NotCountedTable.tsx";
import { RequirementCard } from "../components/RequirementCard.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { useStudent } from "../hooks/useStudent.tsx";

export function AuditPage() {
  const { student } = useStudent();
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    api
      .getAudit(student.id)
      .then((a) => !cancelled && setAudit(a))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "couldn't run the audit"));
    return () => {
      cancelled = true;
    };
  }, [student]);

  if (error) return <p role="alert" className="text-red-700">{error}</p>;
  if (!audit) return <p className="text-slate-600">Running your audit...</p>;

  return (
    <div className="space-y-8">
      <AuditSummary audit={audit} />
      <AuditWarnings warnings={audit.warnings} />

      <section aria-labelledby="reqs" className="space-y-4">
        <h2 id="reqs" className="text-lg font-semibold text-slate-900">
          Requirements
        </h2>
        {[...audit.requirements, ...audit.overlays].map((r) => (
          <RequirementCard key={r.id} req={r} />
        ))}
      </section>

      {audit.designations.length > 0 && (
        <section aria-labelledby="designations" className="space-y-4">
          <h2 id="designations" className="text-lg font-semibold text-slate-900">
            Honours and specializations
          </h2>
          {audit.designations.map((d) => (
            <div key={d.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-900">
                  {d.name}
                  {d.tier && <span className="ml-2 text-sm font-normal text-teal-800">{d.tier}</span>}
                </h3>
                <StatusBadge status={d.status} />
              </div>
              <div className="mt-4 space-y-4">
                {d.requirements.map((r) => (
                  <RequirementCard key={r.id} req={r} depth={1} />
                ))}
              </div>
              {d.notes.map((n) => (
                <p key={n} className="mt-3 text-sm text-amber-900">
                  {n}
                </p>
              ))}
            </div>
          ))}
        </section>
      )}

      <NotCountedTable courses={audit.notCounted} />

      <details className="rounded-lg border border-slate-200 bg-white p-5 text-sm shadow-sm">
        <summary className="cursor-pointer font-medium text-slate-900">How GradTrellis reads the calendar ({audit.interpretations.length})</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
          {audit.interpretations.map((i) => (
            <li key={i.note}>{i.note}</li>
          ))}
        </ul>
      </details>

      <p className="text-sm text-slate-600">
        Missing something? <Link to="/transcript" className="font-medium text-teal-800 hover:underline">Update your transcript</Link>.
      </p>
    </div>
  );
}
