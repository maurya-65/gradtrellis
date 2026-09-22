import { Trash2 } from "lucide-react";
import type { Result, StoredAttempt } from "../api/client.ts";
import { ResultSelect } from "./ResultSelect.tsx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Props {
  label: string;
  attempts: StoredAttempt[];
  onChangeResult: (a: StoredAttempt, result: Result) => void;
  onRemove: (a: StoredAttempt) => void;
}

export function TermTable({ label, attempts, onChangeResult, onRemove }: Props) {
  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{label}</h2>
      <Card className="py-0">
        <Table>
          <TableHeader className="sr-only">
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attempts.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="py-2.5 pl-4">
                  <span className="font-mono font-medium">{a.code}</span>
                  {a.title && <span className="ml-2 text-muted-foreground">{a.title}</span>}
                </TableCell>
                <TableCell className="w-44 py-2.5">
                  <ResultSelect term={a.term} value={a.result} onChange={(r) => onChangeResult(a, r)} aria-label={`Grade for ${a.code} ${label}`} className="w-full" />
                </TableCell>
                <TableCell className="w-12 py-2.5 pr-4 text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => onRemove(a)} aria-label={`Remove ${a.code} ${label}`}>
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}
