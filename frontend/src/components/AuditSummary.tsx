import type { AuditResult } from "../api/client.ts";
import { ProgressBar } from "./ProgressBar.tsx";
import { StatusBadge } from "./StatusBadge.tsx";

const SUMMARY: Record<AuditResult["status"], string> = {
  complete: "All degree requirements are met.",
  "in-progress": "Everything left is in progress. You're on track if you pass your current courses.",
  planned: "Everything left is in progress or planned. You're on track if you pass your current and planned courses.",
  review: "Some requirements need a decision from the Faculty. See the items marked for review.",
  incomplete: "Here's what you still need.",
};

export function AuditSummary({ audit }: { audit: AuditResult }) {
  return (
    <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-600">
            {audit.program.name}, {audit.program.calendarYear} calendar
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Degree audit</h1>
          <p className="mt-2 text-slate-700">{SUMMARY[audit.status]}</p>
        </div>
        <div className="text-right">
          <StatusBadge status={audit.status} />
          <p className="mt-3 text-sm text-slate-600">CGPA</p>
          <p className="text-3xl font-semibold text-slate-900">{audit.cgpa}</p>
        </div>
      </div>
      {!audit.exactCalendar && (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Your entry-year calendar isn't encoded yet, so this audit uses the {audit.program.calendarYear} calendar. Results may differ.
        </p>
      )}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <ProgressBar label="Courses" totals={audit.totals.courses} unit="courses" />
        <ProgressBar label="Credit hours" totals={audit.totals.creditHours} unit="ch" />
      </div>
    </header>
  );
}
