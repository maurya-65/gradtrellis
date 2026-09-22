import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight, BookOpenCheck, FileUp, ListChecks, type LucideIcon } from "lucide-react";
import { AuditPreview } from "../components/AuditPreview.tsx";
import { DegreeClimb } from "../components/DegreeClimb.tsx";
import { Reveal } from "../components/Reveal.tsx";
import { Wordmark } from "../components/Logo.tsx";
import { cn } from "@/lib/utils";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4">
          <a href="#how" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:block">
            How it works
          </a>
          <Link to="/" className="col-start-2">
            <Wordmark />
          </Link>
          <nav className="flex items-center justify-end gap-2 text-sm font-medium">
            <Link to="/login" className="hidden px-3 py-2 text-muted-foreground hover:text-foreground sm:block">
              Log in
            </Link>
            <Link to="/signup" className="rounded-full bg-brand px-4 py-2 text-white hover:bg-brand/90">
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <DegreeClimb />

      <section id="how" className="scroll-mt-16 bg-section py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal>
            <SectionHeading title="How it works">Three steps, about a minute.</SectionHeading>
          </Reveal>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            <Step icon={FileUp} number={1} title="Upload your transcript">
              Use the unofficial transcript PDF from e-Services, or add courses by hand. You check every row before
              it's saved.
            </Step>
            <Step icon={BookOpenCheck} number={2} title="We check it against the calendar">
              Your courses are matched to the calendar for the year you started, each placed where it counts most.
            </Step>
            <Step icon={ListChecks} number={3} title="See what's left">
              Every requirement shows what's done and what's missing, with your GPA and any policy warnings.
            </Step>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-4 py-20 sm:py-28 lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal>
          <SectionHeading title="Your whole degree on one page" align="left">
            Every requirement, how far along it is, and the courses that count toward it, updated the moment you add a
            grade.
          </SectionHeading>
        </Reveal>
        <Reveal delay={120}>
          <AuditPreview />
        </Reveal>
      </section>

      <section className="bg-section py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-4 lg:grid-cols-2">
        <Reveal>
        <SectionHeading title="Every rule cites the calendar" align="left">
          Each requirement shows the page and the words it comes from. When the calendar is unclear, the audit marks it
          for review instead of guessing.
        </SectionHeading>
        </Reveal>
        <div className="grid gap-4">
          <Reveal delay={120} className="rounded-2xl border bg-card p-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Total courses</p>
              <p className="text-sm font-medium text-brand">24 of 40</p>
            </div>
            <blockquote className="mt-4 border-l-2 border-brand pl-4 text-muted-foreground">
              “To earn a BCS degree, a student must complete at least 40 courses, as specified below.”
            </blockquote>
            <p className="mt-3 text-sm text-muted-foreground">Undergraduate Calendar 2024–25, page 197</p>
          </Reveal>
          <Reveal delay={240} className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-6">
            <div>
              <p className="font-semibold">A breadth course that's not on the list</p>
              <p className="mt-1 text-sm text-muted-foreground">Counts only with an advisor's approval.</p>
            </div>
            <span className="shrink-0 rounded-full bg-review/15 px-3 py-1 text-sm font-medium text-review">Review</span>
          </Reveal>
        </div>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal>
            <SectionHeading title="Where it's going">A degree audit today, an advisor tomorrow.</SectionHeading>
          </Reveal>
          <ol className="mt-14 grid gap-5 md:grid-cols-3">
            <Milestone stage="Available now" title="Degree audit" current>
              See where every course counts and what you still need to graduate.
            </Milestone>
            <Milestone stage="Next" title="What you can take">
              Prerequisites checked for you, so you know which courses are open to you next term.
            </Milestone>
            <Milestone stage="Later" title="An advisor you can ask">
              Questions like “Which ML courses fit my degree?”, answered from your record and the calendar.
            </Milestone>
          </ol>
        </div>
      </section>

      <section className="bg-band">
        <Reveal className="mx-auto flex max-w-6xl flex-col items-center px-4 py-20 text-center text-white">
          <h2 className="text-4xl font-[540] tracking-tight sm:text-5xl">See where your degree stands.</h2>
          <p className="mt-4 text-lg text-white/80">It takes about a minute with your transcript.</p>
          <Link
            to="/signup"
            className="mt-9 flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 font-semibold text-white hover:bg-brand/90"
          >
            Get started <ArrowRight className="size-4" />
          </Link>
        </Reveal>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <Wordmark />
          <p className="max-w-xl">
            An independent student project, not affiliated with the University of New Brunswick. The Undergraduate
            Calendar and your Faculty advisor are the authority on degree requirements.
          </p>
        </div>
      </footer>
    </div>
  );
}

function CtaLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 font-semibold text-white shadow-md shadow-brand/15 hover:bg-brand/90"
    >
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function SectionHeading({ title, align = "center", children }: { title: string; align?: "center" | "left"; children: string }) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <h2 className="text-4xl font-[540] tracking-tight sm:text-5xl">{title}</h2>
      <p className="mt-4 text-lg text-muted-foreground">{children}</p>
    </div>
  );
}

function Step({ icon: Icon, number, title, children }: { icon: LucideIcon; number: number; title: string; children: string }) {
  return (
    <Reveal
      delay={(number - 1) * 120}
      className="group rounded-2xl bg-card p-7 shadow-sm ring-1 ring-border transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-center justify-between">
        <span className="flex size-12 items-center justify-center rounded-xl bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-white">
          <Icon className="size-6" />
        </span>
        <span className="text-sm font-medium text-muted-foreground/70">Step {number}</span>
      </div>
      <h3 className="mt-6 text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-muted-foreground">{children}</p>
    </Reveal>
  );
}

function Milestone({ stage, title, current, children }: { stage: string; title: string; current?: boolean; children: ReactNode }) {
  return (
    <li className={cn("rounded-2xl bg-card p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg", current ? "ring-2 ring-brand" : "ring-1 ring-border")}>
      <p className={cn("text-sm font-medium", current ? "text-brand" : "text-muted-foreground/70")}>{stage}</p>
      <h3 className="mt-3 text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-muted-foreground">{children}</p>
    </li>
  );
}
