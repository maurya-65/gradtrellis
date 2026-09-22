// Seeded RNG so failing property tests are reproducible.
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  // mulberry32
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)]!;
  }

  array<T>(min: number, max: number, make: () => T): T[] {
    return Array.from({ length: this.int(min, max) }, make);
  }
}

export function forAll(runs: number, seed: number, check: (rng: Rng, run: number) => boolean): void {
  const rng = new Rng(seed);
  for (let run = 0; run < runs; run++) {
    if (!check(rng, run)) throw new Error(`property failed (seed ${seed}, case ${run})`);
  }
}
