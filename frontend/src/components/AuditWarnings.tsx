import { TriangleAlert } from "lucide-react";
import type { AuditResult } from "../api/client.ts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function AuditWarnings({ warnings }: { warnings: AuditResult["warnings"] }) {
  const shown = warnings.filter((w) => w.level !== "info");
  if (shown.length === 0) return null;

  return (
    <Alert className="border-review/50 bg-review/10">
      <TriangleAlert />
      <AlertTitle>Things to know</AlertTitle>
      <AlertDescription>
        <ul className="grid gap-1">
          {shown.map((w) => (
            <li key={`${w.code}-${w.course ?? ""}`}>{w.message}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
