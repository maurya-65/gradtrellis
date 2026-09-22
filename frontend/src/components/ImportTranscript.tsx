import { useState, type ChangeEvent } from "react";
import { termLabel } from "backend/engine/terms";
import { api, type Result, type Student } from "../api/client.ts";
import { useStudent } from "../hooks/useStudent.tsx";
import { parseTranscript, type ParsedAttempt } from "../transcript/parse.ts";
import { readPdfLines } from "../transcript/pdf.ts";
import { resultOptions } from "./terms.ts";

// The PDF is parsed in the browser. On save, the file is stored with the profile
// (replacing any earlier one) and the reviewed courses replace the transcript.
export function ImportTranscript({ student }: { student: Student }) {
  const { setStudent } = useStudent();
  const [file, setFile] = useState<File | null>(null);
  const [attempts, setAttempts] = useState<ParsedAttempt[] | null>(null);
  const [unreadable, setUnreadable] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = parseTranscript(await readPdfLines(await file.arrayBuffer()));
      if (parsed.attempts.length === 0) {
        setError("No courses found. Upload the unofficial transcript PDF from myUNB.");
      } else {
        setFile(file);
        setAttempts(parsed.attempts);
        setUnreadable(parsed.unreadable);
      }
    } catch {
      setError("Couldn't read that file as a PDF.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!attempts || !file) return;
    setBusy(true);
    setError(null);
    try {
      await api.uploadTranscript(student.id, file);
      setStudent(await api.replaceAttempts(student.id, attempts));
      setAttempts(null);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't save your courses");
    } finally {
      setBusy(false);
    }
  };

  const setResult = (i: number, result: Result) => setAttempts((list) => list!.map((a, j) => (j === i ? { ...a, result } : a)));
  const remove = (i: number) => setAttempts((list) => list!.filter((_, j) => j !== i));

  if (!attempts) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Import your transcript</h2>
        <p className="mt-1 text-sm text-slate-700">
          Upload the unofficial transcript PDF from myUNB and check the courses before they're saved.
        </p>
        <label className="mt-3 inline-block cursor-pointer rounded-md border border-teal-700 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50">
          {busy ? "Reading..." : "Choose PDF"}
          <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => void read(e)} disabled={busy} />
        </label>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  const existing = student.attempts.length;

  return (
    <div className="rounded-lg border border-teal-600 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Check your courses</h2>
      <p className="mt-1 text-sm text-slate-700">
        Found {attempts.length} courses. Courses without a grade are in progress, or planned if their term hasn't started. Fix anything that looks wrong, then save.
      </p>

      {unreadable.length > 0 && (
        <div role="alert" className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          These lines couldn't be read. Add them by hand after saving:
          <ul className="mt-1 list-inside list-disc font-mono text-xs">
            {unreadable.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <table className="mt-4 w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th className="py-2 pr-3 font-semibold">Term</th>
            <th className="py-2 pr-3 font-semibold">Course</th>
            <th className="py-2 pr-3 font-semibold">Grade</th>
            <th className="py-2 font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {attempts.map((a, i) => (
            <tr key={`${termLabel(a.term)} ${a.code}`}>
              <td className="py-2 pr-3 whitespace-nowrap text-slate-700">{termLabel(a.term)}</td>
              <td className="py-2 pr-3">
                <span className="font-mono font-medium text-slate-900">{a.code}</span>
                <span className="ml-2 text-slate-600">{a.title}</span>
              </td>
              <td className="py-2 pr-3">
                <select
                  aria-label={`Grade for ${a.code} ${termLabel(a.term)}`}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                  value={a.result}
                  onChange={(e) => setResult(i, e.target.value as Result)}
                >
                  {resultOptions(a.term).map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2 text-right">
                <button onClick={() => remove(i)} className="text-xs font-medium text-red-700 hover:underline" aria-label={`Leave out ${a.code} ${termLabel(a.term)}`}>
                  Leave out
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void save()}
          disabled={busy || attempts.length === 0}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800 disabled:opacity-50"
        >
          {busy ? "Saving..." : existing > 0 ? `Replace my ${existing} courses with these ${attempts.length}` : `Save ${attempts.length} courses`}
        </button>
        <button onClick={() => setAttempts(null)} disabled={busy} className="text-sm font-medium text-slate-700 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
