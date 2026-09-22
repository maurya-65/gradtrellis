import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { Emblem } from "../components/Logo.tsx";
import { useSession } from "../hooks/useSession.tsx";
import { Button } from "@/components/ui/button";

function greeting(hour: number): string {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Good night";
}

// ticks every second so the clock never lags a minute behind
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// A calm welcome: the logo, the time and a greeting. The details live on the audit page.
export function HomePage() {
  const { user } = useSession();
  const now = useNow();
  if (!user) return null;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 text-center">
      <Emblem animated className="w-28" />
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} ·{" "}
          <time dateTime={now.toISOString()}>{now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {greeting(now.getHours())}, {user.name.split(" ")[0]}
        </h1>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild className="group h-10 px-5">
          <Link to="/audit">
            Degree audit
            <ArrowRight className="transition-transform group-hover:translate-x-1" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-10 px-5">
          <Link to="/transcript">Transcript</Link>
        </Button>
      </div>
    </div>
  );
}
