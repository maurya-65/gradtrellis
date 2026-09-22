import { termLabel } from "backend/engine/terms";
import type { AuditResult } from "../api/client.ts";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function NotCountedTable({ courses }: { courses: AuditResult["notCounted"] }) {
  if (courses.length === 0) return null;

  return (
    <section aria-labelledby="not-counted" className="grid gap-3">
      <h2 id="not-counted" className="text-xl font-semibold tracking-tight">
        Courses that don&apos;t count
      </h2>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Course</TableHead>
              <TableHead>Term</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead className="pr-4">Why</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((n, i) => (
              <TableRow key={`${n.code}-${i}`}>
                <TableCell className="pl-4 font-mono font-medium">{n.code}</TableCell>
                <TableCell className="text-muted-foreground">{termLabel(n.term)}</TableCell>
                <TableCell>{n.result}</TableCell>
                <TableCell className="pr-4 whitespace-normal text-muted-foreground">{n.reason}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}
