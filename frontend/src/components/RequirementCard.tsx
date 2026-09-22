import { CircleCheck, Circle } from "lucide-react";
import type { AuditResult } from "../api/client.ts";
import { STATE_DOT, STATUS_DOT, StatusBadge, StatusDot } from "./StatusBadge.tsx";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Requirement = AuditResult["requirements"][number];
type Status = Requirement["status"];
type CourseState = Requirement["used"][number]["state"];

const STATE_LABEL: Record<CourseState, string | null> = { completed: null, "in-progress": "in progress", planned: "planned" };

function CourseChip({ code, state, note }: { code: string; state: CourseState; note?: string | undefined }) {
  return (
    <Badge variant="outline" title={note} className={cn("h-7 gap-1.5 bg-card px-2.5 font-mono", state !== "completed" && "border-dashed")}>
      <StatusDot className={STATE_DOT[state]} />
      {code}
      {STATE_LABEL[state] && <span className="font-sans text-muted-foreground">{STATE_LABEL[state]}</span>}
    </Badge>
  );
}

// One line of a pool's checklist. Counts past the minimum show as full; the extra courses
// are marked "beyond the minimum" above.
function RuleRow({ title, have, need, detail }: { title: string; have: number; need: number; detail?: string }) {
  const met = have >= need;
  const Icon = met ? CircleCheck : Circle;
  return (
    <li className="grid gap-0.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <Icon className={cn("size-4", met ? "text-complete" : "text-muted-foreground/50")} aria-hidden />
          {title}
        </span>
        <span className={cn("tabular-nums", met ? "font-medium text-complete" : "text-muted-foreground")}>
          {Math.min(have, need)} of {need}
        </span>
      </div>
      {detail && <p className="ml-6 text-xs text-muted-foreground">{detail}</p>}
    </li>
  );
}

// a single course, or a choice like "Calculus I: MATH 1003 or MATH 1053"
interface Row {
  id: string;
  status: Status;
  code: string;
  label?: string | undefined;
  alternatives?: string | undefined;
  note?: string | undefined;
}

function asRow(r: Requirement): Row | null {
  if (r.kind === "course") {
    const used = r.used[0]?.code;
    return { id: r.id, status: r.status, code: used ?? r.title, note: used && used !== r.title ? `for ${r.title}` : undefined };
  }
  const chosen = r.children?.[0];
  if (r.kind === "oneOf" && chosen?.kind === "course") {
    const alternatives = r.notes.find((n) => n.startsWith("alternatively: "))?.replace("alternatively: ", "");
    return { id: r.id, status: r.status, code: chosen.used[0]?.code ?? chosen.title, label: r.title, alternatives };
  }
  return null;
}

const ROW_NOTE: Partial<Record<Status, string>> = { review: "needs review", "in-progress": "in progress", planned: "planned" };

function Checklist({ rows }: { rows: Row[] }) {
  return (
    <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
      {rows.map((row) => (
        <li key={row.id} className="flex items-baseline gap-2">
          <StatusDot className={cn("translate-y-[-1px]", STATUS_DOT[row.status])} />
          <span className="sr-only">{row.status}:</span>
          {row.label && <span className="text-muted-foreground">{row.label}:</span>}
          <span className={cn("font-mono", row.status === "incomplete" && "text-muted-foreground")}>{row.code}</span>
          {row.alternatives && row.status !== "complete" && <span className="text-xs text-muted-foreground">or {row.alternatives}</span>}
          {row.note && <span className="text-xs text-muted-foreground">{row.note}</span>}
          {ROW_NOTE[row.status] && <span className="text-xs text-muted-foreground">{ROW_NOTE[row.status]}</span>}
        </li>
      ))}
    </ul>
  );
}

function Body({ req, depth }: { req: Requirement; depth: number }) {
  // for Option A/B, show the chosen option's courses directly
  const children = req.kind === "oneOf" && req.children?.[0]?.kind === "allOf" ? (req.children[0].children ?? []) : (req.children ?? []);
  const rows = children.map(asRow).filter((r): r is Row => r !== null);
  const nested = children.filter((c) => asRow(c) === null);

  return (
    <>
      {req.kind === "pool" && (req.used.length > 0 || (req.surplus?.length ?? 0) > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {req.used.map((u) => (
            <CourseChip key={u.code} code={u.code} state={u.state} note={u.note} />
          ))}
          {req.surplus?.map((u) => (
            <CourseChip key={u.code} code={u.code} state={u.state} note="beyond the minimum" />
          ))}
        </div>
      )}

      {((req.progress?.length ?? 0) > 0 || (req.constraints?.length ?? 0) > 0) && (
        <ul className="grid gap-2.5">
          {req.progress?.map((p) => (
            // the pool's own minimums: a running count like 8 of 10 courses
            <RuleRow key={p.unit} title={p.unit === "courses" ? "Courses" : "Credit hours"} have={p.have} need={p.need} />
          ))}
          {req.constraints?.map((c) => (
            <RuleRow
              key={c.id}
              title={c.title}
              have={c.have}
              need={c.need}
              detail={c.courses.length ? `Counting: ${c.courses.join(", ")}` : "None counting yet"}
            />
          ))}
        </ul>
      )}

      {req.couldCountWithApproval && (
        <p className="text-muted-foreground">
          Could count with approval ({req.couldCountWithApproval[0]!.by}): {req.couldCountWithApproval.map((c) => c.code).join(", ")}
        </p>
      )}

      {rows.length > 0 && <Checklist rows={rows} />}

      {nested.length > 0 && (
        <div className="grid gap-5">
          {nested.map((c) => (
            <RequirementCard key={c.id} req={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  );
}

function Details({ req, depth }: { req: Requirement; depth: number }) {
  const notes = req.notes.filter((n) => !n.startsWith("alternatively: "));
  return (
    <>
      {req.remaining && req.status !== "complete" && <p>{req.remaining}</p>}
      <Body req={req} depth={depth} />
      {notes.length > 0 && (
        <ul className="grid gap-1 text-xs text-muted-foreground">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </>
  );
}

// Top-level requirements are cards; the ones nested inside (Math Option A/B parts, ...) are sections.
export function RequirementCard({ req, depth = 0 }: { req: Requirement; depth?: number }) {
  const option = req.kind === "oneOf" ? req.chosenOption : undefined;

  if (depth > 0) {
    return (
      <section className="grid gap-3 border-t pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-medium">{req.title}</h4>
            {option && <p className="text-xs text-muted-foreground">Closest option: {option}</p>}
          </div>
          <StatusBadge status={req.status} />
        </div>
        <Details req={req} depth={depth} />
      </section>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{req.title}</CardTitle>
        {option && <CardDescription>Closest option: {option}</CardDescription>}
        <CardAction>
          <StatusBadge status={req.status} />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Details req={req} depth={depth} />
        {req.source?.page && (
          <p className="text-xs text-muted-foreground">
            Calendar: {req.source.section ? `${req.source.section}, ` : ""}p. {req.source.page}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
