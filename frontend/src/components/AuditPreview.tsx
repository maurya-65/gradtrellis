import { useReveal } from "./Reveal.tsx";
import { cn } from "@/lib/utils";

type Status = "complete" | "in progress" | "review";

const ROWS: { name: string; done: number; total: number; status: Status }[] = [
  { name: "Computer Science Core", done: 12, total: 14, status: "in progress" },
  { name: "Mathematics and Statistics", done: 5, total: 5, status: "complete" },
  { name: "Technical Electives", done: 3, total: 7, status: "in progress" },
  { name: "Breadth", done: 6, total: 10, status: "review" },
  { name: "Free Electives", done: 2, total: 4, status: "in progress" },
];

const BAR: Record<Status, string> = {
  complete: "bg-complete",
  "in progress": "bg-in-progress",
  review: "bg-review",
};

const LABEL: Record<Status, string> = {
  complete: "Complete",
  "in progress": "In progress",
  review: "Review",
};

const BADGE: Record<Status, string> = {
  complete: "bg-complete/15 text-complete",
  "in progress": "bg-in-progress/15 text-in-progress",
  review: "bg-review/15 text-review",
};

export function AuditPreview() {
  const { ref, shown } = useReveal<HTMLDivElement>();

  return (
    <div ref={ref} className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
        <div>
          <p className="text-sm text-muted-foreground">Degree audit</p>
          <p className="mt-1 font-semibold">Bachelor of Computer Science, 2024–25</p>
        </div>
        <div className="flex gap-6">
          <Figure label="Courses">28 of 40</Figure>
          <Figure label="GPA">3.5</Figure>
        </div>
      </div>

      <ul className="mt-6 grid gap-5">
        {ROWS.map((row, i) => (
          <li key={row.name}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{row.name}</p>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", BADGE[row.status])}>{LABEL[row.status]}</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-section">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-1000 ease-out motion-reduce:transition-none", BAR[row.status])}
                  style={{ width: shown ? `${(row.done / row.total) * 100}%` : 0, transitionDelay: `${i * 120}ms` }}
                />
              </div>
              <p className="w-14 shrink-0 text-right text-sm text-muted-foreground">
                {row.done} of {row.total}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Figure({ label, children }: { label: string; children: string }) {
  return (
    <p className="text-right">
      <span className="block text-sm text-muted-foreground">{label}</span>
      <span className="text-xl font-[540]">{children}</span>
    </p>
  );
}
