import { useEffect, useId, useRef, useState } from "react";
import { api, type CourseSummary } from "../api/client.ts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  onSelect: (course: CourseSummary) => void;
  // Enter on a code we don't know (retired or transfer course)
  onUnlisted: (code: string) => void;
}

const CODE = /^\s*([A-Za-z]{2,5})\s*(\d{4})\s*$/;

export function CourseSearch({ onSelect, onUnlisted }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const latest = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ticket = ++latest.current;
    const timer = setTimeout(() => {
      api
        .searchCourses(q)
        .then((courses) => {
          if (ticket === latest.current) {
            setResults(courses);
            setActive(0);
          }
        })
        .catch(() => setResults([]));
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const choose = (c: CourseSummary) => {
    onSelect(c);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = results[active];
      if (pick) choose(pick);
      else {
        const m = CODE.exec(query);
        if (m) {
          onUnlisted(`${m[1]!.toUpperCase()} ${m[2]}`);
          setQuery("");
        }
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const unlistedCode = results.length === 0 && CODE.exec(query);

  return (
    <div className="relative grid gap-2">
      <Label htmlFor={`${listId}-input`}>Course</Label>
      <Input
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="CS 2043 or software engineering"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        className="h-10"
      />
      {open && results.length > 0 && (
        <ul id={listId} role="listbox" className="absolute top-full z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
          {results.map((c, i) => (
            <li
              key={c.code}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(c);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-baseline gap-3 rounded-md px-2.5 py-2 text-sm", i === active && "bg-accent text-accent-foreground")}
            >
              <span className="w-20 shrink-0 font-mono font-medium">{c.code}</span>
              <span className="flex-1">{c.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{c.creditHours} ch</span>
            </li>
          ))}
        </ul>
      )}
      {unlistedCode && (
        <p className="text-xs text-muted-foreground">
          Not in the current calendar. Press Enter to add {unlistedCode[1]!.toUpperCase()} {unlistedCode[2]} as a retired or transfer course.
        </p>
      )}
    </div>
  );
}
