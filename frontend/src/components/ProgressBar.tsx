import type { AuditResult } from "../api/client.ts";

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
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium text-slate-800">{label}</span>
        <span className="text-slate-600">
          {have}
          {inProgress > 0 && <span className="text-sky-700"> + {inProgress} in progress</span>}
          {planned > 0 && <span className="text-violet-700"> + {planned} planned</span>} of {need} {unit}
        </span>
      </div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={need}
        aria-valuenow={have}
      >
        <div className="bg-teal-700" style={{ width: `${done}%` }} />
        <div className="bg-sky-400" style={{ width: `${running}%` }} />
        <div className="bg-violet-300" style={{ width: `${later}%` }} />
      </div>
    </div>
  );
}
