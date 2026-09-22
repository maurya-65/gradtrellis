import type { StoredAttempt } from "../api/client.ts";

interface Props {
  label: string;
  attempts: StoredAttempt[];
  onRemove: (a: StoredAttempt) => void;
}

export function TermTable({ label, attempts, onRemove }: Props) {
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
          {attempts.map((a) => (
            <tr key={a.id}>
              <td className="px-4 py-2.5">
                <span className="font-mono font-medium text-slate-900">{a.code}</span>
                {a.title && <span className="ml-2 text-slate-600">{a.title}</span>}
              </td>
              <td className="px-4 py-2.5 text-right font-medium text-slate-800">{a.result === "IP" ? "In progress" : a.result}</td>
              <td className="w-20 px-4 py-2.5 text-right">
                <button onClick={() => onRemove(a)} className="text-xs font-medium text-red-700 hover:underline" aria-label={`Remove ${a.code} ${label}`}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
