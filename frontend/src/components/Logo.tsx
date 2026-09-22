import { useState } from "react";
import bodyDark from "../assets/logo/emblem-body-dark.webp";
import body from "../assets/logo/emblem-body.webp";
import cap from "../assets/logo/emblem-cap.webp";
import wordmarkDark from "../assets/logo/wordmark-dark.webp";
import wordmark from "../assets/logo/wordmark.webp";
import { cn } from "@/lib/utils";

// Cut from the logo prototype: a student climbing a trellis of steps toward a grad cap.
// Dark mode swaps in copies with the charcoal lightened.
function Themed({ light, dark, className }: { light: string; dark: string; className?: string }) {
  return (
    <>
      <img src={light} alt="" className={cn("block dark:hidden", className)} />
      <img src={dark} alt="" className={cn("hidden dark:block", className)} />
    </>
  );
}

// The cap is its own layer so it can be thrown, like at convocation: on arrival and on
// every hover when animated.
export function Emblem({ animated = false, className }: { animated?: boolean; className?: string }) {
  const [tossing, setTossing] = useState(animated);
  return (
    <span className={cn("relative block aspect-square", className)} onMouseEnter={animated ? () => setTossing(true) : undefined}>
      <Themed light={body} dark={bodyDark} className="size-full" />
      {/* where the cap sits in the artwork */}
      <img
        src={cap}
        alt=""
        className={cn("absolute top-0 left-[65.84%] w-[34.16%]", tossing && "motion-safe:animate-cap-toss")}
        onAnimationEnd={() => setTossing(false)}
      />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("group flex items-center gap-2", className)}>
      <Emblem className="size-9 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
      <Themed light={wordmark} dark={wordmarkDark} className="h-6 w-auto" />
      <span className="sr-only">GradTrellis</span>
    </span>
  );
}
