import type { AuditResult } from "../api/client.ts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = AuditResult["status"];
type CourseState = AuditResult["requirements"][number]["used"][number]["state"];

// Status colours come from the theme (index.css). The text stays dark and a coloured dot
// carries the status, so every label is readable.
export const STATUS_DOT: Record<Status, string> = {
  complete: "bg-complete",
  "in-progress": "bg-in-progress",
  planned: "bg-planned",
  review: "bg-review",
  incomplete: "bg-muted-foreground/30",
};

export const STATE_DOT: Record<CourseState, string> = {
  completed: "bg-complete",
  "in-progress": "bg-in-progress",
  planned: "bg-planned",
};

const LABELS: Record<Status, string> = {
  complete: "Complete",
  "in-progress": "In progress",
  planned: "Planned",
  review: "Needs review",
  incomplete: "Incomplete",
};

export function StatusDot({ className }: { className: string }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", className)} />;
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant="outline" className="gap-1.5 bg-card">
      <StatusDot className={STATUS_DOT[status]} />
      {LABELS[status]}
    </Badge>
  );
}
