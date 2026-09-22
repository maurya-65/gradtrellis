import { useMemo, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { compareTerms, termLabel, termOn } from "backend/engine/terms";
import { api, ApiError, type CourseSummary, type Result, type Season, type Student } from "../api/client.ts";
import { CourseSearch } from "./CourseSearch.tsx";
import { ResultSelect } from "./ResultSelect.tsx";
import { defaultResult, termOptions } from "./terms.ts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Selected = { code: string; title?: string; creditHours?: number; listed: boolean };

interface Props {
  student: Student;
  onAdded: () => Promise<void>;
}

export function AddCourseForm({ student, onAdded }: Props) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [term, setTerm] = useState("");
  // null until chosen; then the term decides (in progress now, planned later, a grade before)
  const [result, setResult] = useState<Result | null>(null);
  const [creditHours, setCreditHours] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const terms = useMemo(() => termOptions(student.program.entry), [student]);
  // Default to the current term (or the entry term, if that's later).
  const now = termOn(new Date());
  const defaultTerm = compareTerms(now, student.program.entry) >= 0 ? now : student.program.entry;
  const chosenTerm = term || termLabel(defaultTerm);
  const [season, year] = chosenTerm.split(" ") as [Season, string];
  const chosen = { season, year: Number(year) };
  const effectiveResult = result ?? defaultResult(chosen);
  const needsHours = selected !== null && !selected.listed;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !effectiveResult) return;
    setBusy(true);
    setError(null);
    try {
      await api.addAttempt({
        code: selected.code,
        term: chosen,
        result: effectiveResult,
        ...(selected.listed ? {} : { creditHours: Number(creditHours), ...(selected.title ? { title: selected.title } : {}) }),
      });
      setSelected(null);
      setResult(null);
      setCreditHours("");
      await onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "couldn't add the course");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a course</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={add} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            {selected ? (
              <div className="grid gap-2">
                <Label>Course</Label>
                <div className="flex h-10 items-center justify-between gap-2 rounded-lg border border-primary/40 bg-accent px-3 text-sm">
                  <span className="truncate">
                    <span className="font-mono font-medium">{selected.code}</span>
                    {selected.title && <span className="ml-2 text-muted-foreground">{selected.title}</span>}
                  </span>
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => setSelected(null)} aria-label="Choose a different course">
                    <X />
                  </Button>
                </div>
              </div>
            ) : (
              <CourseSearch
                onSelect={(c: CourseSummary) => setSelected({ code: c.code, title: c.title, creditHours: c.creditHours, listed: true })}
                onUnlisted={(code) => setSelected({ code, listed: false })}
              />
            )}

            <div className="grid gap-2">
              <Label htmlFor="term">Term</Label>
              <Select
                value={chosenTerm}
                onValueChange={(v) => {
                  setTerm(v);
                  setResult(null);
                }}
              >
                <SelectTrigger id="term" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {terms.map((t) => (
                    <SelectItem key={termLabel(t)} value={termLabel(t)}>
                      {termLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="result">Grade</Label>
              <ResultSelect id="result" term={chosen} value={effectiveResult} onChange={setResult} className="h-10 w-full" />
            </div>

            <Button type="submit" className="h-10" disabled={!selected || !effectiveResult || busy || (needsHours && !creditHours)}>
              <Plus />
              Add
            </Button>
          </div>

          {needsHours && (
            <div className="grid max-w-xs gap-2">
              <Label htmlFor="ch">Credit hours for {selected.code}</Label>
              <Input id="ch" type="number" min={0} max={12} step={0.5} className="h-10" value={creditHours} onChange={(e) => setCreditHours(e.target.value)} />
              <p className="text-xs text-muted-foreground">This course isn&apos;t in the current calendar, so its credit hours come from your transcript.</p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
