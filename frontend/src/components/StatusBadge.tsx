import type { AuditResult } from "../api/client.ts";

type Status = AuditResult["status"];

const STYLES: Record<Status, { label: string; className: string }> = {
  complete: { label: "Complete", className: "bg-emerald-100 text-emerald-800 ring-emerald-600/20" },
  "in-progress": { label: "In progress", className: "bg-sky-100 text-sky-800 ring-sky-600/20" },
  planned: { label: "Planned", className: "bg-violet-100 text-violet-800 ring-violet-600/20" },
  review: { label: "Needs review", className: "bg-amber-100 text-amber-900 ring-amber-600/30" },
  incomplete: { label: "Incomplete", className: "bg-slate-100 text-slate-700 ring-slate-500/20" },
};

export function StatusBadge({ status }: { status: Status }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.className}`}>
      {s.label}
    </span>
  );
}
