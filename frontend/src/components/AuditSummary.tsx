import { TriangleAlert } from "lucide-react";
import type { AuditResult } from "../api/client.ts";
import { ProgressBar } from "./ProgressBar.tsx";
import { StatusBadge } from "./StatusBadge.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const SUMMARY: Record<AuditResult["status"], string> = {
  complete: "All degree requirements are met.",
  "in-progress": "Everything left is in progress. You're on track if you pass your current courses.",
  planned: "Everything left is in progress or planned. You're on track if you pass your current and planned courses.",
  review: "Some requirements need a decision from the Faculty. See the items marked for review.",
  incomplete: "Here's what you still need.",
};

export function AuditSummary({ audit }: { audit: AuditResult }) {
  const { have, need } = audit.totals.courses;

  return (
    <Card>
      <CardContent className="grid gap-6 py-2">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">
              {audit.program.name} · {audit.program.calendarYear} calendar
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {audit.status === "complete" ? "Every requirement met." : `${have} courses down, ${Math.max(0, need - have)} to go.`}
            </h1>
            <p className="text-muted-foreground">{SUMMARY[audit.status]}</p>
          </div>
          <div className="grid justify-items-end gap-2">
            <StatusBadge status={audit.status} />
            <p className="mt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">CGPA</p>
            <p className="text-4xl font-semibold tracking-tight text-primary">{audit.cgpa}</p>
          </div>
        </div>

        {!audit.exactCalendar && (
          <Alert>
            <TriangleAlert />
            <AlertDescription>
              Your entry-year calendar isn&apos;t encoded yet, so this audit uses the {audit.program.calendarYear} calendar. Results may differ.
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        <div className="grid gap-6 md:grid-cols-2">
          <ProgressBar label="Courses" totals={audit.totals.courses} unit="courses" />
          <ProgressBar label="Credit hours" totals={audit.totals.creditHours} unit="ch" />
        </div>
      </CardContent>
    </Card>
  );
}
