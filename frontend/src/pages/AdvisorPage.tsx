import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUp, ArrowUpRight, RotateCcw } from "lucide-react";
import { api } from "../api/client.ts";
import { AdvisorOrb } from "../components/AdvisorOrb.tsx";
import { useSession } from "../hooks/useSession.tsx";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  from: "student" | "advisor";
  text: string;
  failed?: boolean;
}

const STARTERS = ["What do I have left?", "What should I take next term?", "Can I take CS 3383 next term?", "What's my CGPA?"];

const THINKING_STEPS = ["Reading your transcript…", "Checking the calendar…", "Working it out…"];
const STEP_MS = 700;
// Engine answers take milliseconds; a short pause lets the thinking moment register
// instead of flashing past.
const MIN_THINKING_MS = 1200;
const WORD_MS = 35;

const COURSE_CODE = /\b[A-Z]{2,5} \d{4}\b/g;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// the end of the next word (and the space after it) from a position
function nextWordEnd(text: string, from: number): number {
  const word = /\S+\s*/y;
  word.lastIndex = from;
  return word.exec(text) ? word.lastIndex : text.length;
}

// Reveals a reply a word at a time, like it's being written.
function useTypewriter(text: string, onStep: () => void): string {
  const [shown, setShown] = useState(() => (reducedMotion() ? text.length : 0));
  useEffect(() => {
    if (shown >= text.length) return;
    const id = setTimeout(() => {
      setShown((n) => nextWordEnd(text, n));
      onStep();
    }, WORD_MS);
    return () => clearTimeout(id);
  }, [shown, text, onStep]);
  return text.slice(0, shown);
}

// Words fade in as they appear; course codes become chips that ask about the course. Keys are
// positions, which stay put as the text grows, so earlier words don't animate again.
function words(line: string, onCourse: (code: string) => void): ReactNode[] {
  const parts: ReactNode[] = [];
  const addWords = (text: string) => {
    for (const piece of text.split(/(\s+)/)) {
      if (!piece) continue;
      parts.push(
        /\s/.test(piece) ? piece : (
          <span key={parts.length} className="motion-safe:animate-word-in">
            {piece}
          </span>
        ),
      );
    }
  };
  let last = 0;
  for (const m of line.matchAll(COURSE_CODE)) {
    addWords(line.slice(last, m.index));
    parts.push(
      <button
        key={parts.length}
        type="button"
        onClick={() => onCourse(m[0])}
        className="rounded-md bg-brand-soft px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-brand transition-colors hover:bg-brand hover:text-white motion-safe:animate-word-in"
      >
        {m[0]}
      </button>,
    );
    last = m.index + m[0].length;
  }
  addWords(line.slice(last));
  return parts;
}

type Block = { list: false; line: string } | { list: true; items: string[] };

// "- " lines become a list; other lines are paragraphs
function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  for (const line of text.split("\n")) {
    const last = blocks.at(-1);
    if (line.startsWith("- ")) {
      if (last?.list) last.items.push(line.slice(2));
      else blocks.push({ list: true, items: [line.slice(2)] });
    } else if (line.trim()) {
      blocks.push({ list: false, line });
    }
  }
  return blocks;
}

function Caret() {
  return <span aria-hidden className="ml-0.5 inline-block h-[1.05em] w-[3px] translate-y-[0.2em] rounded-full bg-brand shadow-[0_0_10px_var(--brand)]" />;
}

// the caret, while writing, sits after the last word
function Formatted({ text, writing, onCourse }: { text: string; writing: boolean; onCourse: (code: string) => void }) {
  const blocks = blocksOf(text);
  return (
    <div className="grid gap-3">
      {blocks.map((block, b) => {
        const caret = writing && b === blocks.length - 1 && <Caret />;
        if (!block.list) {
          return (
            <p key={b}>
              {words(block.line, onCourse)}
              {caret}
            </p>
          );
        }
        return (
          <ul key={b} className="grid gap-1.5 pl-1">
            {block.items.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand/60" />
                <span>
                  {words(item, onCourse)}
                  {i === block.items.length - 1 && caret}
                </span>
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}

function AdvisorReply({ message, onCourse, onStep }: { message: Message; onCourse: (code: string) => void; onStep: () => void }) {
  const shown = useTypewriter(message.text, onStep);
  const writing = shown.length < message.text.length;
  return (
    <div className="flex gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
      <AdvisorOrb state={writing ? "speaking" : "idle"} className="mt-0.5 size-7" />
      <div className={cn("min-w-0 flex-1 pt-0.5 leading-relaxed", message.failed && "text-destructive")}>
        <Formatted text={shown} writing={writing} onCourse={onCourse} />
      </div>
    </div>
  );
}

function Thinking() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, THINKING_STEPS.length - 1)), STEP_MS);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-3 motion-safe:animate-in motion-safe:fade-in" role="status">
      <AdvisorOrb state="thinking" className="size-7" />
      {/* each step fades up into place; the text itself shimmers */}
      <span key={step} className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <span className="bg-[linear-gradient(90deg,var(--muted-foreground)_0%,var(--foreground)_50%,var(--muted-foreground)_100%)] bg-[length:200%_100%] bg-clip-text text-transparent motion-safe:animate-shimmer">
          {THINKING_STEPS[step]}
        </span>
      </span>
    </div>
  );
}

function Welcome({ firstName, onAsk }: { firstName: string; onAsk: (q: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 py-10 text-center">
      <AdvisorOrb className="size-16" />
      <div className="grid gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">What can I help you figure out, {firstName}?</h1>
        <p className="text-muted-foreground text-balance">I read your record against the UNB calendar, so every answer comes straight from your degree.</p>
      </div>
      <div className="grid w-full gap-2 sm:grid-cols-2">
        {STARTERS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onAsk(q)}
            className="group flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
          >
            {q}
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function AdvisorPage() {
  const { user } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const nextId = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  // block bodies: an effect must not return scrollIntoView's result (a Promise in newer
  // browsers), or React treats it as the cleanup function
  const scrollToEnd = useCallback(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, []);
  useEffect(() => {
    scrollToEnd();
  }, [messages, thinking, scrollToEnd]);

  const add = (message: Omit<Message, "id">) => setMessages((m) => [...m, { ...message, id: nextId.current++ }]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || thinking) return;
    setDraft("");
    add({ from: "student", text });
    setThinking(true);
    const pause = wait(reducedMotion() ? 0 : MIN_THINKING_MS);
    try {
      const { answer } = await api.askAdvisor(text);
      await pause;
      add({ from: "advisor", text: answer });
    } catch (err) {
      await pause;
      add({ from: "advisor", text: err instanceof Error ? err.message : "Something went wrong. Try again in a moment.", failed: true });
    } finally {
      setThinking(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(draft);
  };

  // Enter sends, Shift+Enter adds a line
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void ask(draft);
    }
  };

  const askAbout = (code: string) => void ask(`Tell me about ${code}`);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-14rem)] max-w-3xl flex-col">
      {messages.length === 0 ? (
        <Welcome firstName={user?.name.split(" ")[0] ?? "there"} onAsk={(q) => void ask(q)} />
      ) : (
        <div className="grid flex-1 content-start gap-6 pb-6">
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setMessages([])} disabled={thinking}>
              <RotateCcw />
              New chat
            </Button>
          </div>
          {messages.map((m) =>
            m.from === "student" ? (
              <p
                key={m.id}
                className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 whitespace-pre-wrap text-background motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
              >
                {m.text}
              </p>
            ) : (
              <AdvisorReply key={m.id} message={m} onCourse={askAbout} onStep={scrollToEnd} />
            ),
          )}
          {thinking && <Thinking />}
          <div ref={endRef} />
        </div>
      )}

      <form onSubmit={submit} className="sticky bottom-0 mt-4 bg-linear-to-t from-background from-75% to-transparent pt-6 pb-4">
        <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-lg shadow-foreground/5 transition focus-within:border-brand/50 focus-within:ring-4 focus-within:ring-brand/10">
          <textarea
            rows={1}
            maxLength={500}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about your degree…"
            aria-label="Your question"
            className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 outline-none placeholder:text-muted-foreground"
          />
          <Button type="submit" size="icon" className="size-10 rounded-xl" disabled={thinking || !draft.trim()} aria-label="Ask">
            <ArrowUp />
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Answers come from your audit and the UNB calendar. Confirm big decisions with your Faculty advisor.
        </p>
      </form>
    </div>
  );
}
