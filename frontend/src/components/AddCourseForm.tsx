import { useMemo, useState, type FormEvent } from "react";
import { api, ApiError, type CourseSummary, type Result, type Season, type Student } from "../api/client.ts";
import { CourseSearch } from "./CourseSearch.tsx";
import { compareTerms, termLabel, termOn } from "backend/engine/terms";
import { resultOptions, termOptions } from "./terms.ts";

type Selected = { code: string; title?: string; creditHours?: number; listed: boolean };

interface Props {
  student: Student;
  onAdded: () => Promise<void>;
}

export function AddCourseForm({ student, onAdded }: Props) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [term, setTerm] = useState("");
  const [result, setResult] = useState<Result>("A");
  const [creditHours, setCreditHours] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const terms = useMemo(() => termOptions(student.program.entry), [student]);
  // Default to the current term (or the entry term, if that's later).
  const now = termOn(new Date());
  const defaultTerm = compareTerms(now, student.program.entry) >= 0 ? now : student.program.entry;
  const chosenTerm = term || termLabel(defaultTerm);
  const [season, year] = chosenTerm.split(" ") as [Season, string];

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.addAttempt(student.id, {
        code: selected.code,
        term: { season, year: Number(year) },
        result,
        ...(selected.listed ? {} : { creditHours: Number(creditHours), ...(selected.title ? { title: selected.title } : {}) }),
      });
      setSelected(null);
      setCreditHours("");
      await onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "couldn't add the course");
    } finally {
      setBusy(false);
    }
  };

  const field = "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30";
  const needsHours = selected && !selected.listed;

  return (
    <form onSubmit={add} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Add a course</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
        {selected ? (
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-800">Course</span>
            <div className="flex items-center justify-between rounded-md border border-teal-600 bg-teal-50 px-3 py-2 text-sm">
              <span>
                <span className="font-mono font-medium">{selected.code}</span>
                {selected.title && <span className="ml-2 text-slate-700">{selected.title}</span>}
              </span>
              <button type="button" onClick={() => setSelected(null)} className="text-xs font-medium text-teal-800 hover:underline">
                Change
              </button>
            </div>
          </div>
        ) : (
          <CourseSearch
            onSelect={(c: CourseSummary) => setSelected({ code: c.code, title: c.title, creditHours: c.creditHours, listed: true })}
            onUnlisted={(code) => setSelected({ code, listed: false })}
          />
        )}

        <div>
          <label htmlFor="term" className="mb-1 block text-sm font-medium text-slate-800">
            Term
          </label>
          <select id="term" className={`w-full ${field}`} value={chosenTerm} onChange={(e) => setTerm(e.target.value)}>
            {terms.map((t) => (
              <option key={termLabel(t)}>{termLabel(t)}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="result" className="mb-1 block text-sm font-medium text-slate-800">
            Grade
          </label>
          <select id="result" className={`w-full ${field}`} value={result} onChange={(e) => setResult(e.target.value as Result)}>
            {resultOptions({ season, year: Number(year) }).map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={!selected || busy || (needsHours ? !creditHours : false)}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {needsHours && (
        <div className="mt-4 max-w-xs">
          <label htmlFor="ch" className="mb-1 block text-sm font-medium text-slate-800">
            Credit hours for {selected.code}
          </label>
          <input id="ch" type="number" min={0} max={12} step={0.5} className={`w-full ${field}`} value={creditHours} onChange={(e) => setCreditHours(e.target.value)} />
          <p className="mt-1 text-xs text-slate-600">This course isn't in the current calendar, so its credit hours come from your transcript.</p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
