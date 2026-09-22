// ids match the designations in the program data
const DESIGNATIONS = [
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

  return DESIGNATIONS.map((d) => (
    <label key={d.id} className="flex items-center gap-2 text-sm text-slate-800">
      <input
        type="checkbox"
        checked={value.includes(d.id)}
        disabled={disabled}
        onChange={(e) => toggle(d.id, e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 accent-teal-700"
      />
      {d.label}
    </label>
  ));
}
