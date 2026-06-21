import type { Photo } from "../../photoStore";
import type { PortfolioWork } from "../types";

export const POOL_SIZE = 72;

/** px the hovered tile grows into the 12px gap; leaves 4px margin. */
export const EXPAND = 8;

/** Fixed seed → layout is deterministic and stable across renders. */
const SEED = 0x9e3779b9;

// Varied tile footprints, weighted so big tiles stay a minority and
// grid-flow-dense still backfills cleanly.
const SPAN_WEIGHTS = [
  { span: "col-span-1 row-span-1", w: 40 },
  { span: "col-span-2 row-span-1", w: 20 },
  { span: "col-span-1 row-span-2", w: 20 },
  { span: "col-span-2 row-span-2", w: 20 },
];
const SPAN_TOTAL = SPAN_WEIGHTS.reduce((sum, s) => sum + s.w, 0);

// ── Deterministic PRNG (mulberry32) ─────────────────────────────────
// Same seed always yields the same sequence.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickSpan(rng: () => number): string {
  let r = rng() * SPAN_TOTAL;
  for (const s of SPAN_WEIGHTS) {
    if (r < s.w) return s.span;
    r -= s.w;
  }
  return SPAN_WEIGHTS[0].span;
}

// ── Pool builder ────────────────────────────────────────────────────
// Fill a dense grid from a small photo set, but break up the obvious
// repetition: shuffle placement (no diagonal lattice) and randomize
// tile sizes (no fixed rhythm). Same set of unique image URLs → no
// extra network/decode cost.

export function buildImagePool(source: Photo[]): PortfolioWork[] {
  if (source.length === 0) return [];
  const rng = mulberry32(SEED);
  const n = source.length;

  // Balanced remaining counts so every photo appears ~equally.
  const counts = Array.from(
    { length: n },
    (_, i) => Math.floor(POOL_SIZE / n) + (i < POOL_SIZE % n ? 1 : 0),
  );

  // Place photos one slot at a time, each pick chosen *randomly* from
  // those that still have slots left and haven't appeared in the last
  // `window` tiles. window=1 just blocks back-to-back repeats and
  // lets randomness handle the rest.
  const window = Math.min(1, n - 1);
  const recent: number[] = [];
  const order: number[] = [];

  for (let k = 0; k < POOL_SIZE; k++) {
    const pool: number[] = [];
    for (let p = 0; p < n; p++) if (counts[p] > 0 && !recent.includes(p)) pool.push(p);
    // If the window leaves nothing (small photo sets), relax it.
    if (pool.length === 0) for (let p = 0; p < n; p++) if (counts[p] > 0) pool.push(p);

    // Weight by remaining count so no photo gets stranded at the end.
    let total = 0;
    for (const p of pool) total += counts[p];
    let r = rng() * total;
    let pick = pool[0];
    for (const p of pool) {
      if (r < counts[p]) { pick = p; break; }
      r -= counts[p];
    }

    order.push(pick);
    counts[pick]--;
    recent.push(pick);
    if (recent.length > window) recent.shift();
  }

  return order.map((photoIndex, index) => {
    const photo = source[photoIndex];
    const span = pickSpan(rng);
    return {
      ...photo,
      alt: photo.alt ?? photo.title,
      span,
      id: `${photo.title}-${index}`,
    };
  });
}
