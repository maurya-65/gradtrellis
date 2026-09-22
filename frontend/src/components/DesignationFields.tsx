import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// ids match the designations in the program data
export const DESIGNATIONS = [
  { id: "honours", label: "Honours in Computer Science" },
  { id: "cybersecurity", label: "Specialization in Cybersecurity" },
];

interface Props {
  value: string[];
  onChange: (designations: string[]) => void;
  disabled?: boolean;
}

export function DesignationFields({ value, onChange, disabled }: Props) {
  const toggle = (id: string, checked: boolean) => onChange(checked ? [...value, id] : value.filter((d) => d !== id));

  return (
    <div className="grid gap-3">
      {DESIGNATIONS.map((d) => (
        <div key={d.id} className="flex items-center gap-3">
          <Checkbox id={`designation-${d.id}`} checked={value.includes(d.id)} disabled={disabled} onCheckedChange={(c) => toggle(d.id, c === true)} />
          <Label htmlFor={`designation-${d.id}`} className="font-normal">
            {d.label}
          </Label>
        </div>
      ))}
    </div>
  );
}
