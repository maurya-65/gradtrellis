import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// The trellis on the building's centre: 5 columns x 8 rows = 40 courses, two rows a year.
const LEFT = 420;
const RIGHT = 580;
const COLUMNS = [LEFT, 460, 500, 540, RIGHT];
const ROWS = [715, 660, 605, 550, 495, 440, 385, 330];

// Climbed row by row, left to right then back, the way a vine would go.
const NODES = ROWS.flatMap((y, row) => (row % 2 === 0 ? COLUMNS : [...COLUMNS].reverse()).map((x) => ({ x, y })));
const SUMMIT = { x: 462, y: 290 };
const VINE = "M" + NODES.map((n) => `${n.x},${n.y}`).join(" L");
// a leaf between each pair of courses, opening once the vine has grown past it
const LEAVES = NODES.slice(1).map((b, i) => {
  const a = NODES[i]!;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 5, angle: i % 2 ? 35 : -35 };
});
const YEAR_LABEL_YS = [0, 1, 2, 3].map((year) => (ROWS[year * 2]! + ROWS[year * 2 + 1]!) / 2 + 4);

// What a typical year's ten courses count toward (the groups add up to the BCS calendar's 40).
const YEARS = [
  "CS core 5 · Math and stats 3 · Breadth 2",
  "CS core 5 · Math and stats 2 · Breadth 3",
  "CS core 4 · Technical electives 3 · Breadth 3",
  "Technical electives 4 · Breadth 2 · Free electives 4",
];

// Windows light up from the ground floor as the climb goes on: 24 of them over 40 courses.
const WINDOWS = [610, 520, 430].flatMap((y) =>
  [165, 205, 245, 285].flatMap((x) => [
    { x, y },
    { x: 1000 - x - 26, y },
  ]),
);

const HEADER_HEIGHT = 64;

function useScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      // the scene sticks below the 4rem header, so it pins at top = 64
      const box = el.getBoundingClientRect();
      const scrollable = box.height - window.innerHeight + HEADER_HEIGHT;
      setProgress(Math.min(1, Math.max(0, (HEADER_HEIGHT - box.top) / scrollable)));
      setNarrow(window.innerWidth < 640);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return { ref, progress, narrow };
}

function climberPosition(courses: number) {
  const path = [...NODES, SUMMIT];
  const i = Math.min(Math.floor(courses), path.length - 2);
  const t = courses - i;
  const a = path[i]!;
  const b = path[i + 1]!;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function DegreeClimb() {
  const { ref, progress, narrow } = useScrollProgress();
  // the last stretch of scrolling holds on the finished climb
  const courses = Math.min(1, progress / 0.9) * NODES.length;
  const done = Math.floor(courses);
  const graduated = done >= NODES.length;
  const year = Math.min(3, Math.floor(done / 10));
  const climber = climberPosition(courses);

  return (
    <div ref={ref} className="relative h-[320vh]">
      <div className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col items-center px-4 pt-6 pb-4">
        <h1 className="text-center text-3xl font-[540] tracking-tight sm:text-[2.75rem]">
          Know exactly what's <span className="text-brand">left in your degree.</span>
        </h1>
        <p className="mt-2 max-w-xl text-center text-muted-foreground">
          Upload your unofficial transcript and see every course checked against the Undergraduate Calendar.
        </p>

        <svg
          viewBox={narrow ? "330 120 340 640" : "130 115 740 640"}
          className="mt-2 min-h-0 w-full max-w-5xl flex-1"
          role="img"
          aria-label={`A student climbing a trellis on a university building: ${done} of 40 courses`}
        >
          <Building done={done} graduated={graduated} />

          <g className="stroke-foreground/55" strokeWidth="1.75">
            {COLUMNS.map((x) => (
              <line key={x} x1={x} y1={740} x2={x} y2={310} />
            ))}
            {ROWS.map((y) => (
              <line key={y} x1={LEFT - 12} y1={y} x2={RIGHT + 12} y2={y} />
            ))}
          </g>

          <path
            d={VINE}
            pathLength={1}
            fill="none"
            className="stroke-complete"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1"
            strokeDashoffset={1 - Math.min(courses, NODES.length - 1) / (NODES.length - 1)}
          />

          {LEAVES.map((leaf, i) => (
            <ellipse
              key={i}
              cx={leaf.x}
              cy={leaf.y}
              rx="8"
              ry="4"
              transform={`rotate(${leaf.angle} ${leaf.x} ${leaf.y})`}
              className={cn("fill-complete transition-opacity duration-300", i < done ? "opacity-90" : "opacity-0")}
            />
          ))}

          {NODES.map((n, i) => (
            <circle
              key={i}
              cx={n.x}
              cy={n.y}
              r="6"
              strokeWidth="1.75"
              className={cn(
                "transition-colors duration-300",
                i < done ? "fill-brand stroke-brand" : i === done ? "fill-brand-soft stroke-brand" : "fill-card stroke-muted-foreground/50",
              )}
            />
          ))}

          {YEAR_LABEL_YS.map((labelY, y) => (
            <text
              key={y}
              x={LEFT - 22}
              y={labelY}
              textAnchor="end"
              fontSize="15"
              className={cn("transition-colors", y === year && !graduated ? "fill-foreground font-medium" : "fill-muted-foreground/60")}
            >
              Year {y + 1}
            </text>
          ))}

              <g className="animate-[bob_2.4s_ease-in-out_infinite] motion-reduce:animate-none">
            <Climber x={climber.x} y={climber.y} step={Math.floor(courses * 2) % 2} />
          </g>
        </svg>

        <div className="flex h-20 flex-col items-center justify-center text-center">
          {graduated ? (
            <>
              <p className="font-medium">All 40 courses. Graduation.</p>
              <Link
                to="/signup"
                className="mt-3 flex items-center gap-2 rounded-full bg-brand px-6 py-3 font-semibold text-white shadow-md shadow-brand/15 hover:bg-brand/90"
              >
                Check my degree <ArrowRight className="size-4" />
              </Link>
            </>
          ) : progress < 0.02 ? (
            <p className="flex flex-col items-center text-sm text-muted-foreground">
              Scroll to climb
              <ChevronDown className="mt-1 size-4 animate-bounce motion-reduce:animate-none" />
            </p>
          ) : (
            <>
              <p className="font-medium">
                Year {year + 1} <span className="text-muted-foreground">· {done} of 40 courses</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{YEARS[year]}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Loosely after UNB's Old Arts Building: two wings, a central pavilion with a pediment, and a cupola.
function Building({ done, graduated }: { done: number; graduated: boolean }) {
  return (
    <g fill="none" strokeWidth="1.25" className="stroke-foreground/30">
      <line x1="100" y1="740" x2="900" y2="740" />
      <rect x="140" y="400" width="720" height="340" />
      <polyline points="140,400 180,365 820,365 860,400" />
      {WINDOWS.map((w, i) => (
        <rect
          key={`${w.x}-${w.y}`}
          x={w.x}
          y={w.y}
          width="26"
          height="50"
          className={cn(
            "transition-colors duration-700",
            done > ((i + 1) * NODES.length) / WINDOWS.length ? "fill-review/25" : "fill-transparent",
          )}
        />
      ))}
      <rect x="480" y="175" width="40" height="75" className={cn("transition-colors duration-700", graduated ? "fill-review/30" : "fill-background")} />
      <path d="M492,205 v-14 a8,8 0 0 1 16,0 v14" />
      <path d="M476,175 Q500,132 524,175" />
      <line x1="500" y1="150" x2="500" y2="128" />
      <rect x="400" y="310" width="200" height="430" className="fill-background" />
      <polygon
        points="388,310 500,245 612,310"
        className={cn("fill-background transition-colors duration-500", graduated && "stroke-brand")}
        strokeWidth={graduated ? 2 : 1.25}
      />
      <circle cx="500" cy="286" r="10" />
    </g>
  );
}

// A simple pictogram: one hand on the trellis, the other carrying a laptop.
function Climber({ x, y, step }: { x: number; y: number; step: number }) {
  return (
    <g transform={`translate(${x - 9} ${y + 51}) scale(1.5)`} strokeLinecap="round" strokeLinejoin="round">
      <g className="stroke-foreground" strokeWidth="3" fill="none">
        <line x1="0" y1="-24" x2="0" y2="-11" />
        <polyline points={step ? "0,-22 6,-34" : "0,-22 7,-29"} />
        <polyline points="0,-21 -6,-15" />
        <polyline points={step ? "0,-11 -5,0" : "0,-11 -6,-6 -5,0"} />
        <polyline points={step ? "0,-11 5,-6 5,0" : "0,-11 5,0"} />
      </g>
      <circle cx="0" cy="-30" r="4.5" className="fill-foreground" />
      <rect x="-15" y="-17" width="10" height="7" rx="1.5" className="fill-brand" transform="rotate(-15 -10 -13)" />
    </g>
  );
}
