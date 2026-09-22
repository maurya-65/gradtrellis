import type { AuditResult } from "../api/client.ts";
import { StatusDot } from "./StatusBadge.tsx";

interface Props {
  label: string;
  totals: AuditResult["totals"]["courses"];
  unit: string;
}

export function ProgressBar({ label, totals, unit }: Props) {
  const { have, inProgress, planned, need } = totals;
  const pct = (n: number) => Math.min(100, (n / need) * 100);
  const done = pct(have);
  const running = Math.min(100 - done, pct(inProgress));
  const later = Math.min(100 - done - running, pct(planned));

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">{have}</span> of {need} {unit}
        </span>
      </div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={need}
        aria-valuenow={have}
      >
        <div className="bg-complete" style={{ width: `${done}%` }} />
        <div className="bg-in-progress" style={{ width: `${running}%` }} />
        <div className="bg-planned" style={{ width: `${later}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {inProgress > 0 && (
          <span className="flex items-center gap-1.5">
            <StatusDot className="bg-in-progress" />
            {inProgress} in progress
          </span>
        )}
        {planned > 0 && (
          <span className="flex items-center gap-1.5">
            <StatusDot className="bg-planned" />
            {planned} planned
          </span>
        )}
      </div>
    </div>
  );
}
