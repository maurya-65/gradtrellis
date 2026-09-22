interface Props {
  label: string;
  have: number;
  inProgress: number;
  need: number;
  unit: string;
}

export function ProgressBar({ label, have, inProgress, need, unit }: Props) {
  const pct = (n: number) => Math.min(100, (n / need) * 100);
  const done = pct(have);
  const running = Math.min(100 - done, pct(inProgress));

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium text-slate-800">{label}</span>
        <span className="text-slate-600">
          {have}
          {inProgress > 0 && <span className="text-sky-700"> + {inProgress} in progress</span>} of {need} {unit}
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
      </div>
    </div>
  );
}
