import type { AuditResult } from "../api/client.ts";

export function AuditWarnings({ warnings }: { warnings: AuditResult["warnings"] }) {
  const shown = warnings.filter((w) => w.level !== "info");
  if (shown.length === 0) return null;

  return (
    <section aria-labelledby="warnings" className="rounded-lg border border-amber-300 bg-amber-50 p-5">
      <h2 id="warnings" className="text-base font-semibold text-amber-950">
        Things to know
      </h2>
      <ul className="mt-2 space-y-1 text-sm text-amber-950">
        {shown.map((w) => (
          <li key={`${w.code}-${w.course ?? ""}`}>{w.message}</li>
        ))}
      </ul>
    </section>
  );
}
