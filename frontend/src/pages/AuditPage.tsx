import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api, type AuditResult } from "../api/client.ts";
import { AuditSummary } from "../components/AuditSummary.tsx";
import { AuditWarnings } from "../components/AuditWarnings.tsx";
import { NotCountedTable } from "../components/NotCountedTable.tsx";
import { RequirementCard } from "../components/RequirementCard.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { useSession } from "../hooks/useSession.tsx";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AuditPage() {
  const { student } = useSession();
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    api
      .getAudit()
      .then((a) => !cancelled && setAudit(a))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "couldn't run the audit"));
    return () => {
      cancelled = true;
    };
  }, [student]);

  if (error)
    return (
      <p role="alert" className="text-destructive">
        {error}
      </p>
    );
  if (!audit)
    return (
      <div className="grid gap-4" aria-label="Running your audit">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );

  return (
    <div className="grid gap-10">
      <div className="grid gap-4">
        <AuditSummary audit={audit} />
        <AuditWarnings warnings={audit.warnings} />
      </div>

      <section aria-labelledby="reqs" className="grid gap-4">
        <h2 id="reqs" className="text-xl font-semibold tracking-tight">
          Requirements
        </h2>
        {[...audit.requirements, ...audit.overlays].map((r) => (
          <RequirementCard key={r.id} req={r} />
        ))}
      </section>

      {audit.designations.length > 0 && (
        <section aria-labelledby="designations" className="grid gap-4">
          <h2 id="designations" className="text-xl font-semibold tracking-tight">
            Honours and specializations
          </h2>
          {audit.designations.map((d) => (
            <Card key={d.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {d.name}
                  {d.tier && <span className="ml-2 font-normal text-primary">{d.tier}</span>}
                </CardTitle>
                <CardAction>
                  <StatusBadge status={d.status} />
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-5">
                {d.requirements.map((r) => (
                  <RequirementCard key={r.id} req={r} depth={1} />
                ))}
                {d.notes.map((n) => (
                  <p key={n} className="text-muted-foreground">
                    {n}
                  </p>
                ))}
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <NotCountedTable courses={audit.notCounted} />

      <Card>
        <CardContent>
          <details>
            <summary className="cursor-pointer font-medium">How GradTrellis reads the calendar ({audit.interpretations.length})</summary>
            <ul className="mt-3 grid list-disc gap-2 pl-5 text-muted-foreground">
              {audit.interpretations.map((i) => (
                <li key={i.note}>{i.note}</li>
              ))}
            </ul>
          </details>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Missing something?{" "}
        <Link to="/transcript" className="font-medium text-primary hover:underline">
          Update your transcript
        </Link>
        .
      </p>
    </div>
  );
}
