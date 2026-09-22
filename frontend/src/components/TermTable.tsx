import type { Result, StoredAttempt } from "../api/client.ts";
import { resultOptions } from "./terms.ts";

interface Props {
  label: string;
  attempts: StoredAttempt[];
  onChangeResult: (a: StoredAttempt, result: Result) => void;
  onRemove: (a: StoredAttempt) => void;
}

export function TermTable({ label, attempts, onChangeResult, onRemove }: Props) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">{label}</h2>
      <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-sm">
        <thead className="sr-only">
          <tr>
            <th>Course</th>
            <th>Grade</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {attempts.map((a) => {
            const options = resultOptions(a.term);
            return (
              <tr key={a.id}>
                <td className="px-4 py-2.5">
                  <span className="font-mono font-medium text-slate-900">{a.code}</span>
                  {a.title && <span className="ml-2 text-slate-600">{a.title}</span>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {options.length === 1 ? (
                    <span className="font-medium text-slate-800">{options[0]!.label}</span>
                  ) : (
                    <select
                      aria-label={`Grade for ${a.code} ${label}`}
                      className="rounded-md border border-transparent bg-transparent px-2 py-1 text-right font-medium text-slate-800 hover:border-slate-300 focus:border-teal-600 focus:outline-none"
                      value={a.result}
                      onChange={(e) => onChangeResult(a, e.target.value as Result)}
                    >
                      {options.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="w-20 px-4 py-2.5 text-right">
                  <button onClick={() => onRemove(a)} className="text-xs font-medium text-red-700 hover:underline" aria-label={`Remove ${a.code} ${label}`}>
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
