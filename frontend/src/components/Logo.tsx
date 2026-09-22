import { cn } from "@/lib/utils";

// a trellis: the lattice a degree grows on
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <path d="M10 24V9m6 15V9m6 15V9M7 13.5h18M7 19.5h18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Logo className="size-8" />
      <span className="text-lg font-semibold tracking-tight">GradTrellis</span>
    </span>
  );
}
