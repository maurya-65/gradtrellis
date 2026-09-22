import type { AuditResult } from "../api/client.ts";
import { termLabel } from "backend/engine/terms";

export function NotCountedTable({ courses }: { courses: AuditResult["notCounted"] }) {
  if (courses.length === 0) return null;

  return (
    <section aria-labelledby="not-counted">
      <h2 id="not-counted" className="text-lg font-semibold text-slate-900">
        Courses that don't count
      </h2>
      <table className="mt-3 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-4 py-2 font-medium">Course</th>
            <th className="px-4 py-2 font-medium">Term</th>
            <th className="px-4 py-2 font-medium">Grade</th>
            <th className="px-4 py-2 font-medium">Why</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {courses.map((n, i) => (
            <tr key={`${n.code}-${i}`}>
              <td className="px-4 py-2 font-mono">{n.code}</td>
              <td className="px-4 py-2 text-slate-700">{termLabel(n.term)}</td>
              <td className="px-4 py-2 text-slate-700">{n.result}</td>
              <td className="px-4 py-2 text-slate-700">{n.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
