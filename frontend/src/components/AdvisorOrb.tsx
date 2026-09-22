import { cn } from "@/lib/utils";

export type OrbState = "idle" | "thinking" | "speaking";

const BREATH: Record<OrbState, string> = {
  idle: "motion-safe:animate-orb-breathe",
  thinking: "motion-safe:animate-orb-think",
  speaking: "motion-safe:animate-orb-speak",
};

// Wayfarers, drawn across the upper middle of the orb. Black in both themes, with a glint.
function Sunglasses() {
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
      <rect x="9" y="37" width="82" height="6" rx="3" fill="#141414" />
      <path d="M12 40H46V50C46 58 40 63 32 63H26C18 63 12 58 12 50Z" fill="#141414" />
      <path d="M54 40H88V50C88 58 82 63 74 63H68C60 63 54 58 54 50Z" fill="#141414" />
      <path d="M18 47l8-4M60 47l8-4" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

// The advisor's presence: a glowing orb in the brand colours, in sunglasses. It breathes
// slowly at rest, sends out ripples while it thinks, and keeps a quicker rhythm while it speaks.
export function AdvisorOrb({ state = "idle", className }: { state?: OrbState; className?: string }) {
  return (
    <span aria-hidden className={cn("relative block shrink-0", className)}>
      {state === "thinking" &&
        ["0s", "0.9s"].map((delay) => (
          <span key={delay} className="absolute inset-0 rounded-full border border-brand/50 motion-safe:animate-orb-ripple" style={{ animationDelay: delay }} />
        ))}
      <span className={cn("absolute -inset-1/4 rounded-full bg-brand/30 blur-xl", BREATH[state])} />
      <span className="absolute inset-0 overflow-hidden rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff_0%,var(--brand)_42%,#5c0718_100%)] shadow-lg shadow-brand/25">
        <span
          className={cn(
            "absolute -inset-1/2 bg-[conic-gradient(from_0deg,transparent_0deg,rgb(255_255_255/0.35)_60deg,transparent_140deg)]",
            state === "idle" ? "motion-safe:animate-orb-spin" : "motion-safe:animate-orb-spin-fast",
          )}
        />
        <Sunglasses />
      </span>
    </span>
  );
}
