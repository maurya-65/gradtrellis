import { useState, type ChangeEvent } from "react";
import { termLabel } from "backend/engine/terms";
import { api, type Result, type Student } from "../api/client.ts";
import { useSession } from "../hooks/useSession.tsx";
import { parseTranscript, type ParsedAttempt } from "backend/transcript";
import { readPdfLines } from "../transcript/pdf.ts";
import { ResultSelect } from "./ResultSelect.tsx";
import { FileUp, TriangleAlert, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// The PDF is parsed in the browser. On save, the file is stored with the profile
// (replacing any earlier one) and the reviewed courses replace the transcript.
export function ImportTranscript({ student }: { student: Student }) {
  const { user, setUser, setStudent } = useSession();
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
      if (parsed.student && parsed.student.number !== user?.studentNumber) {
        setError(`This transcript is for student number ${parsed.student.number}, but your account has ${user?.studentNumber}.`);
      } else if (parsed.attempts.length === 0) {
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
      // upload first: it checks the student number before any courses change
      const verified = await api.uploadTranscript(file);
      setStudent(await api.replaceAttempts(attempts));
      await setUser(verified);
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
      <Card>
        <CardHeader>
          <CardTitle>Import your transcript</CardTitle>
          <CardDescription>Upload the unofficial transcript PDF from myUNB and check the courses before they&apos;re saved.</CardDescription>
          <CardAction>
            <Button asChild variant="outline" className="h-10">
              <label className={busy ? "pointer-events-none opacity-60" : "cursor-pointer"}>
                <FileUp />
                {busy ? "Reading..." : "Choose PDF"}
                <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => void read(e)} disabled={busy} />
              </label>
            </Button>
          </CardAction>
        </CardHeader>
        {error && (
          <CardContent>
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          </CardContent>
        )}
      </Card>
    );
  }

  const existing = student.attempts.length;

  return (
    <Card className="ring-2 ring-primary/40">
      <CardHeader>
        <CardTitle>Check your courses</CardTitle>
        <CardDescription>
          Found {attempts.length} courses. Courses without a grade are in progress, or planned if their term hasn&apos;t started. Fix anything that
          looks wrong, then save.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {unreadable.length > 0 && (
          <Alert>
            <TriangleAlert />
            <AlertTitle>Some lines couldn&apos;t be read</AlertTitle>
            <AlertDescription>
              Add these by hand after saving:
              <ul className="mt-1 list-inside list-disc font-mono text-xs">
                {unreadable.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Term</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attempts.map((a, i) => (
              <TableRow key={`${termLabel(a.term)} ${a.code}`}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{termLabel(a.term)}</TableCell>
                <TableCell>
                  <span className="font-mono font-medium">{a.code}</span>
                  <span className="ml-2 text-muted-foreground">{a.title}</span>
                </TableCell>
                <TableCell className="w-44">
                  <ResultSelect term={a.term} value={a.result} onChange={(r) => setResult(i, r)} aria-label={`Grade for ${a.code} ${termLabel(a.term)}`} className="w-full" />
                </TableCell>
                <TableCell className="w-12 text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => remove(i)} aria-label={`Leave out ${a.code} ${termLabel(a.term)}`}>
                    <X className="text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
      <CardFooter className="gap-3 border-t pt-4 pb-4">
        <Button onClick={() => void save()} disabled={busy || attempts.length === 0} className="h-10">
          {busy ? "Saving..." : existing > 0 ? `Replace my ${existing} courses with these ${attempts.length}` : `Save ${attempts.length} courses`}
        </Button>
        <Button variant="ghost" onClick={() => setAttempts(null)} disabled={busy} className="h-10">
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}
