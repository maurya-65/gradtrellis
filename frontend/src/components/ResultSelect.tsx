import type { Result, Season } from "../api/client.ts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resultOptions } from "./terms.ts";

interface Props {
  id?: string;
  term: { season: Season; year: number };
  value: Result | null;
  onChange: (result: Result) => void;
  "aria-label"?: string;
  className?: string;
}

// The grade picker: which results make sense depends on the term (planned courses have none).
export function ResultSelect({ id, term, value, onChange, className, ...rest }: Props) {
  const options = resultOptions(term);
  return (
    <Select value={value ?? undefined} onValueChange={(v) => onChange(v as Result)} disabled={options.length === 1}>
      <SelectTrigger id={id} aria-label={rest["aria-label"]} className={className}>
        <SelectValue placeholder="Choose a grade" />
      </SelectTrigger>
      <SelectContent>
        {options.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
