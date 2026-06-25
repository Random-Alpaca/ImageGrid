import type { Photo } from "../../photoStore";
import type { PortfolioWork } from "../types";

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

function getSpanArea(span: string): number {
  let w = 1, h = 1;
  if (span.includes("col-span-2")) w = 2;
  if (span.includes("row-span-2")) h = 2;
  return w * h;
}

// ── Pool builder ────────────────────────────────────────────────────
// Fill a dense grid from a small photo set, but break up the obvious
// repetition: shuffle placement (no diagonal lattice) and randomize
// tile sizes (no fixed rhythm).
//
// CRITICAL: To prevent grid layout "snaps" during infinite scrolling,
// the generated layout must repeat perfectly. Since `grid-flow-dense`
// packs items continuously, iteration 1 will only pack identically to
// iteration 0 if iteration 0 leaves NO holes at its bottom.
//
// We ensure a perfectly flat bottom mathematically:
// 1. Grid columns are 3, 6, 8, or 10. LCM = 120.
// 2. We make the total area of the pool exactly 240 (a multiple of 120).
// 3. We reserve the last 30 tiles strictly as 1x1 fillers. Because they
//    are placed last, `grid-flow-dense` will use them to backfill any
//    ragged holes left by larger tiles, perfectly flattening the bottom!

export function buildImagePool(source: Photo[]): PortfolioWork[] {
  if (source.length === 0) return [];
  const rng = mulberry32(SEED);
  const n = source.length;

  const targetArea = 240;
  const fillerArea = 30; // Last 30 cells will be guaranteed 1x1 fillers

  const pool: PortfolioWork[] = [];
  let currentArea = 0;

  // Balanced remaining counts so every photo appears ~equally.
  const counts = Array.from({ length: n }, () => Math.floor(150 / n) + 1);

  const window = Math.min(1, n - 1);
  const recent: number[] = [];

  const pickPhoto = () => {
    const candidates: number[] = [];
    for (let p = 0; p < n; p++) if (counts[p] > 0 && !recent.includes(p)) candidates.push(p);

    if (candidates.length === 0) {
      for (let p = 0; p < n; p++) if (counts[p] > 0) candidates.push(p);
    }
    if (candidates.length === 0) candidates.push(0);

    let total = 0;
    for (const p of candidates) total += counts[p];
    let r = rng() * total;
    let pick = candidates[0];
    for (const p of candidates) {
      if (r < counts[p]) { pick = p; break; }
      r -= counts[p];
    }
    counts[pick]--;
    recent.push(pick);
    if (recent.length > window) recent.shift();
    return pick;
  };

  let idCounter = 0;

  // 1. Place random tiles until we are just short of the filler area
  while (currentArea < targetArea - fillerArea) {
    const photoIndex = pickPhoto();
    const photo = source[photoIndex];
    let span = pickSpan(rng);
    let area = getSpanArea(span);

    // If this tile exceeds our random allocation, downgrade it or skip it
    if (currentArea + area > targetArea - fillerArea) {
      span = "col-span-1 row-span-1";
      area = 1;
      if (currentArea + area > targetArea - fillerArea) {
        continue;
      }
    }

    pool.push({
      ...photo,
      alt: photo.alt ?? photo.title,
      span,
      id: `${photo.title}-${idCounter++}`,
    });
    currentArea += area;
  }

  // 2. Fill the rest of the target area EXCLUSIVELY with 1x1 tiles
  // These will backfill any ragged holes in the grid layout, leaving a perfectly flat bottom.
  while (currentArea < targetArea) {
    const photoIndex = pickPhoto();
    const photo = source[photoIndex];
    pool.push({
      ...photo,
      alt: photo.alt ?? photo.title,
      span: "col-span-1 row-span-1",
      id: `${photo.title}-${idCounter++}`,
    });
    currentArea += 1;
  }

  return pool;
}
