import type { AuditResult } from "../api/client.ts";
import { StatusBadge } from "./StatusBadge.tsx";

type Requirement = AuditResult["requirements"][number];
type Status = Requirement["status"];

const DOT: Record<Status, string> = {
  complete: "bg-teal-700",
  "in-progress": "bg-sky-400",
  review: "bg-amber-500",
  incomplete: "bg-slate-300",
};

function CourseChip({ code, state, note }: { code: string; state: "completed" | "in-progress"; note?: string | undefined }) {
  return (
    <span
      title={note}
      className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs ${
        state === "completed" ? "border-teal-700/20 bg-teal-50 text-teal-900" : "border-dashed border-sky-600/60 bg-sky-50 text-sky-900"
      }`}
    >
      {code}
      {state === "in-progress" && <span className="ml-1 font-sans text-[10px] uppercase tracking-wide text-sky-700">in progress</span>}
    </span>
  );
}

// a single course, or a choice like "Calculus I: MATH 1003 or MATH 1053"
interface Row {
  id: string;
  status: Status;
  code: string;
  label?: string | undefined;
  alternatives?: string | undefined;
  note?: string | undefined;
}

function asRow(r: Requirement): Row | null {
  if (r.kind === "course") {
    const used = r.used[0]?.code;
    return { id: r.id, status: r.status, code: used ?? r.title, note: used && used !== r.title ? `for ${r.title}` : undefined };
  }
  const chosen = r.children?.[0];
  if (r.kind === "oneOf" && chosen?.kind === "course") {
    const alternatives = r.notes.find((n) => n.startsWith("alternatively: "))?.replace("alternatively: ", "");
    return { id: r.id, status: r.status, code: chosen.used[0]?.code ?? chosen.title, label: r.title, alternatives };
  }
  return null;
}

function Checklist({ rows }: { rows: Row[] }) {
  return (
    <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
      {rows.map((row) => (
        <li key={row.id} className="flex items-baseline gap-2 text-sm">
          <span aria-hidden className={`h-2 w-2 shrink-0 translate-y-[-1px] rounded-full ${DOT[row.status]}`} />
          <span className="sr-only">{row.status}:</span>
          {row.label && <span className="text-slate-700">{row.label}:</span>}
          <span className="font-mono text-slate-900">{row.code}</span>
          {row.alternatives && row.status !== "complete" && <span className="text-xs text-slate-500">or {row.alternatives}</span>}
          {row.note && <span className="text-xs text-slate-600">{row.note}</span>}
          {row.status === "review" && <span className="text-xs text-amber-800">needs review</span>}
          {row.status === "in-progress" && <span className="text-xs text-sky-700">in progress</span>}
        </li>
      ))}
    </ul>
  );
}

function Body({ req, depth }: { req: Requirement; depth: number }) {
  // for Option A/B, show the chosen option's courses directly
  const children = req.kind === "oneOf" && req.children?.[0]?.kind === "allOf" ? (req.children[0].children ?? []) : (req.children ?? []);
  const rows = children.map(asRow).filter((r): r is Row => r !== null);
  const nested = children.filter((c) => asRow(c) === null);

  return (
    <>
      {req.kind === "pool" && (req.used.length > 0 || (req.surplus?.length ?? 0) > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {req.used.map((u) => (
            <CourseChip key={u.code} code={u.code} state={u.state} note={u.note} />
          ))}
          {req.surplus?.map((u) => (
            <CourseChip key={u.code} code={u.code} state={u.state} note="beyond the minimum" />
          ))}
        </div>
      )}

      {req.constraints && req.constraints.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {req.constraints.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3">
              <span className="text-slate-700">{c.title}</span>
              <span className={c.have >= c.need ? "font-medium text-teal-800" : "text-slate-600"}>
                {c.have} of {c.need}
              </span>
            </li>
          ))}
        </ul>
      )}

      {req.couldCountWithApproval && (
        <p className="mt-3 text-sm text-amber-900">
          Could count with approval ({req.couldCountWithApproval[0]!.by}): {req.couldCountWithApproval.map((c) => c.code).join(", ")}
        </p>
      )}

      {rows.length > 0 && <Checklist rows={rows} />}

      {nested.length > 0 && (
        <div className="mt-4 space-y-4">
          {nested.map((c) => (
            <RequirementCard key={c.id} req={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  );
}

export function RequirementCard({ req, depth = 0 }: { req: Requirement; depth?: number }) {
  const notes = req.notes.filter((n) => !n.startsWith("alternatively: "));
  const option = req.kind === "oneOf" ? req.chosenOption : undefined;

  return (
    <section className={depth === 0 ? "rounded-lg border border-slate-200 bg-white p-5 shadow-sm" : "border-t border-slate-100 pt-4"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={depth === 0 ? "text-base font-semibold text-slate-900" : "text-sm font-semibold text-slate-800"}>{req.title}</h3>
          {option && <p className="text-xs text-slate-600">Closest option: {option}</p>}
        </div>
        <StatusBadge status={req.status} />
      </div>

      {req.remaining && req.status !== "complete" && <p className="mt-2 text-sm text-slate-700">{req.remaining}</p>}

      <Body req={req} depth={depth} />

      {notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-slate-600">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      {depth === 0 && req.source?.page && (
        <p className="mt-3 text-xs text-slate-500">
          Calendar: {req.source.section ? `${req.source.section}, ` : ""}p. {req.source.page}
        </p>
      )}
    </section>
  );
}
