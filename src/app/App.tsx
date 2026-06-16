import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, LayoutList, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import { fetchPhotos, staticPhotos, type Photo } from "../photoStore";

const POOL_SIZE = 72;
const SEED = 0x9e3779b9; // fixed → layout is deterministic and stable across renders

// Varied tile footprints, weighted so big tiles stay a minority and grid-flow-dense
// still backfills cleanly. Picked at random (seeded) so the size rhythm never repeats.
const SPAN_WEIGHTS = [
  { span: "col-span-1 row-span-1", w: 44 },
  { span: "col-span-1 row-span-2", w: 16 },
  { span: "col-span-2 row-span-1", w: 14 },
  { span: "col-span-2 row-span-2", w: 14 },
  { span: "col-span-3 row-span-2", w: 7 },
  { span: "col-span-2 row-span-3", w: 5 },
];
const SPAN_TOTAL = SPAN_WEIGHTS.reduce((sum, s) => sum + s.w, 0);

// Tiny deterministic PRNG (mulberry32) — same seed always yields the same sequence.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LARGE_SPANS = new Set(["col-span-3 row-span-2", "col-span-2 row-span-3"]);

function pickSpan(rng: () => number, lastSpan?: string): string {
  for (let attempt = 0; attempt < 6; attempt++) {
    let r = rng() * SPAN_TOTAL;
    for (const s of SPAN_WEIGHTS) {
      if (r < s.w) {
        if (LARGE_SPANS.has(s.span) && s.span === lastSpan) break; // retry
        return s.span;
      }
      r -= s.w;
    }
  }
  return SPAN_WEIGHTS[0].span;
}

type PortfolioWork = Photo & { alt: string; span: string; id: string };

// Fill a dense grid from a small photo set, but break up the obvious repetition:
// shuffle placement (no diagonal lattice) and randomize tile sizes (no fixed rhythm).
// Same set of unique image URLs → no extra network/decode cost.
function buildImagePool(source: Photo[]): PortfolioWork[] {
  if (source.length === 0) return [];
  const rng = mulberry32(SEED);
  const n = source.length;

  // Balanced remaining counts so every photo appears ~equally across the pool.
  const counts = Array.from(
    { length: n },
    (_, i) => Math.floor(POOL_SIZE / n) + (i < POOL_SIZE % n ? 1 : 0),
  );

  // Place photos one slot at a time, each pick chosen *randomly* from those that
  // still have slots left and haven't appeared in the last `window` tiles. Random
  // selection (vs. a deterministic forward scan) avoids same-photo clustering
  // *without* introducing a new fixed period the way a greedy de-cluster does.
  // window=1 just blocks back-to-back repeats and lets randomness handle the rest:
  // a larger window starves the candidate pool when there are few photos and forces
  // a visible cycle (e.g. 3 photos + window 2 → strict ABCABC).
  const window = Math.min(1, n - 1);
  const recent: number[] = [];
  const order: number[] = [];

  for (let k = 0; k < POOL_SIZE; k++) {
    const pool: number[] = [];
    for (let p = 0; p < n; p++) if (counts[p] > 0 && !recent.includes(p)) pool.push(p);
    // If the window leaves nothing (small photo sets), relax it for this slot.
    if (pool.length === 0) for (let p = 0; p < n; p++) if (counts[p] > 0) pool.push(p);

    // Weight by remaining count so no photo gets stranded into a cluster at the end.
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

  let lastSpan: string | undefined;
  return order.map((photoIndex, index) => {
    const photo = source[photoIndex];
    const span = pickSpan(rng, lastSpan);
    lastSpan = span;
    return {
      ...photo,
      alt: photo.alt ?? photo.title,
      span,
      id: `${photo.title}-${index}`,
    };
  });
}

const modalTransition = {
  duration: 1.08,
  ease: [0.16, 1, 0.3, 1] as const,
};

const chromeTransition = {
  duration: 0.42,
  ease: [0.2, 0.8, 0.2, 1] as const,
};

export default function App() {
  // Seed with the static list for an instant first paint, then swap in the
  // backend's published photos once they load.
  const [photoList, setPhotoList] = useState<Photo[]>(staticPhotos);
  useEffect(() => {
    let active = true;
    fetchPhotos().then((list) => {
      if (active) setPhotoList(list);
    });
    return () => {
      active = false;
    };
  }, []);
  const imagePool = useMemo(() => buildImagePool(photoList), [photoList]);
  const listPool = useMemo<PortfolioWork[]>(() =>
    photoList.map((photo, i) => ({
      ...photo,
      alt: photo.alt ?? photo.title,
      span: "",
      id: `list-${photo.title}-${i}`,
    })),
    [photoList]
  );
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<PortfolioWork | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [origin, setOrigin] = useState("center center");

  // The grid drift and the nav's spinning glass border both pause together so
  // the glass freezes in sync with the photos it's refracting.
  const isPaused = hovered !== null || selected !== null;

  const toggleView = () => {
    setSelected(null);
    setIsClosing(false);
    setHovered(null);
    setView(v => v === "grid" ? "list" : "grid");
  };

  // Compute a transform-origin from the tile's position inside the grid so the
  // subtle scale-up always reads as growing *inward* near the edges.
  const openModal = (work: PortfolioWork) => {
    setIsClosing(false);
    setSelected(work);
  };

  const closeModal = () => {
    if (!selected || isClosing) return;

    setIsClosing(true);
    setHovered(null);
    // 280ms: just long enough for the caption exit (0.24s) to finish before
    // the backdrop fade and layoutId fly-back start — all three then overlap.
    window.setTimeout(() => {
      setSelected(null);
      setIsClosing(false);
    }, 280);
  };

  const handleEnter = (event: React.MouseEvent<HTMLElement>, id: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const grid = event.currentTarget.closest("[data-grid]");
    const bounds = grid?.getBoundingClientRect();
    if (bounds) {
      const leftGap = rect.left - bounds.left;
      const rightGap = bounds.right - rect.right;
      const x = rightGap < 80 ? "right" : leftGap < 80 ? "left" : "center";
      const topGap = rect.top - bounds.top;
      const bottomGap = bounds.bottom - rect.bottom;
      const y = bottomGap < 80 ? "bottom" : topGap < 80 ? "top" : "center";
      setOrigin(`${x} ${y}`);
    }
    setHovered(id);
  };

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground selection:bg-primary selection:text-primary-foreground">

      {/* Outer wrapper — owns fixed positioning and the spinning conic gradient border */}
      <div className="nav-wrap" style={{ animationPlayState: isPaused ? "paused" : "running" }}>
        <nav className="nav-glass flex items-center justify-between px-4 py-3 text-white md:px-6">
          {/* Dome highlight — convex lens catching light from above */}
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,255,255,0.22) 0%, transparent 70%)" }} />
          {/* Bottom vignette — shadow inside the dome */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5" style={{ background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.12))" }} />
          <div className="relative flex items-center gap-3"><span className="text-xl font-medium" style={{ color: "var(--glass-text)", textShadow: "0 1px 8px var(--glass-shadow), 0 0 30px var(--glass-shadow)" }}>Jacky Xue</span></div>
          <div className="relative flex items-center gap-2">
            <button onClick={toggleView} className="nav-button flex items-center justify-center rounded-full p-2 transition" style={{ color: "var(--glass-text)" }} aria-label="Toggle view">
              {view === "grid" ? <LayoutGrid className="size-4" /> : <LayoutList className="size-4" />}
            </button>
            <a href="https://jxue.ca" className="nav-button flex items-center gap-2 rounded-full px-4 py-2 text-sm transition" style={{ color: "var(--glass-text)" }}>Home</a>
          </div>
        </nav>
        {/* Lifted shadow — blurred copy below for the floating 3-D look */}
        <div className="nav-shadow" />
      </div>

      <AnimatePresence mode="wait">
        {view === "grid" ? (
          <motion.section
            key="grid"
            className="relative z-10 mx-auto flex h-screen w-full max-w-[1800px] flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="relative flex-1 overflow-hidden">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-14 bg-gradient-to-b from-black to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-28 bg-gradient-to-t from-black to-transparent" />
              <div
                className="animate-[drift_120s_linear_infinite] px-4 md:px-8"
                style={{ willChange: "transform", transform: "translateZ(0)", animationPlayState: isPaused ? "paused" : "running" }}
              >
                <div data-grid className="grid grid-flow-dense auto-rows-[122px] grid-cols-3 gap-3 pt-4 md:auto-rows-[150px] md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                  {imagePool.map((work) => {
                    const isExpanded = hovered === work.id;
                    const isDimmed = hovered !== null && !isExpanded;

                    return (
                      <motion.button
                        key={work.id}
                        onMouseEnter={(event) => handleEnter(event, work.id)}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={(event) => handleEnter(event, work.id)}
                        onBlur={() => setHovered(null)}
                        onClick={() => openModal(work)}
                        animate={{ scale: isExpanded ? 1.06 : 1 }}
                        transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
                        style={{ transformOrigin: isExpanded ? origin : "center center", zIndex: isExpanded ? 20 : 1 }}
                        className={`${work.span} group/card relative min-h-0 overflow-hidden rounded-[1.15rem] bg-muted text-left shadow-sm transition-[border-radius,box-shadow] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] hover:rounded-[1.6rem] hover:shadow-2xl hover:shadow-[rgba(0,0,0,0.45)] focus:outline-none focus:ring-2 focus:ring-primary`}
                      >
                        <motion.img
                          layoutId={`portfolio-image-${work.id}`}
                          src={work.src}
                          alt={work.alt}
                          className="size-full object-cover"
                          transition={modalTransition}
                        />
                        <div
                          className="absolute inset-0 transition-opacity duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
                          style={{ opacity: isDimmed ? 0.55 : 0, background: "var(--dim-overlay)" }}
                        />
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.section>
        ) : (
          <motion.section
            key="list"
            className="relative z-10 h-screen overflow-y-auto bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="mx-auto max-w-3xl space-y-3 px-4 pb-12 pt-28 md:px-8">
              {listPool.map((item, i) => (
                <motion.button
                  key={item.id}
                  onClick={() => openModal(item)}
                  className="w-full text-left"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3), ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <div className="flex items-stretch gap-4 rounded-[1.6rem] p-2 transition-colors hover:bg-white/[0.03]">
                    {/* Thumbnail */}
                    <div className="relative h-40 w-32 shrink-0 overflow-hidden rounded-[1.2rem] bg-black shadow-xl shadow-black/60 ring-1 ring-white/10 md:h-48 md:w-40">
                      <motion.img
                        layoutId={`portfolio-image-${item.id}`}
                        src={item.src}
                        alt={item.alt}
                        className="size-full object-cover"
                        transition={modalTransition}
                      />
                    </div>
                    {/* Info pane */}
                    <div className="glass-pane flex flex-1 flex-col justify-center p-5 md:p-6">
                      <h3 className="text-2xl font-medium leading-tight tracking-[-0.02em]" style={{ color: "var(--glass-text)" }}>{item.title}</h3>
                      <p className="mt-2 text-sm leading-6" style={{ color: "var(--glass-text-muted)" }}>{item.caption}</p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-40 grid place-items-center bg-[rgba(0,0,0,0.55)] p-4 backdrop-blur-md"
            onClick={closeModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div
              className="flex h-[88vh] w-full max-w-6xl flex-col items-center justify-center gap-4 md:grid md:grid-cols-[minmax(0,1fr)_390px] md:gap-8"
            >
              {/* Figure hugs the photo's native proportions — no bars, no blurred fill */}
              <motion.figure
                className="relative max-h-[58vh] max-w-full overflow-hidden rounded-[1.8rem] bg-black shadow-2xl shadow-black/70 md:ml-auto md:max-h-[84vh] md:max-w-full"
                layout
                transition={modalTransition}
                onClick={(event) => event.stopPropagation()}
              >
                <motion.img
                  layoutId={`portfolio-image-${selected.id}`}
                  src={selected.src}
                  alt={selected.alt}
                  className="block max-h-[58vh] w-auto max-w-full object-contain md:max-h-[84vh]"
                  transition={modalTransition}
                />
                <AnimatePresence>
                  {!isClosing && (
                    <motion.div
                      className="pointer-events-none absolute inset-0 rounded-[1.8rem] ring-1 ring-white/15"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { ...chromeTransition, delay: 0.82 } }}
                      exit={{ opacity: 0, transition: { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] } }}
                    />
                  )}
                </AnimatePresence>
              </motion.figure>

              <AnimatePresence>
                {!isClosing && (
                  <motion.aside
                    className="glass-pane w-full max-w-[390px] p-6 text-white md:relative md:w-[390px] md:p-7"
                    initial={{ opacity: 0, x: 28, scale: 0.96 }}
                    animate={{ opacity: 1, x: 0, scale: 1, transition: { ...chromeTransition, delay: 0.92 } }}
                    exit={{ opacity: 0, x: 18, scale: 0.97, transition: { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] } }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button onClick={closeModal} className="mb-7 ml-auto grid size-10 place-items-center rounded-full bg-[#186440]/20 transition hover:bg-[#186440]/30"><X className="size-5" /></button>
                    <h3 className="text-5xl font-medium leading-[0.95] tracking-[-0.02em]" style={{ textShadow: "0 1px 12px rgba(0,0,0,0.6)" }}>{selected.title}</h3>
                    <p className="mt-6 leading-7 text-white/75">{selected.caption}</p>
                  </motion.aside>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes drift { from { transform: translateY(0); } to { transform: translateY(-50%); } }

        @property --nav-angle {
          syntax: "<angle>";
          inherits: false;
          initial-value: -75deg;
        }
        @keyframes nav-spin { to { --nav-angle: 285deg; } }

        .nav-wrap {
          position: fixed;
          left: 50%;
          top: 1.25rem;
          transform: translateX(-50%);
          z-index: 30;
          width: calc(100% - 2rem);
          max-width: 56rem;
          padding: 1.5px;
          border-radius: 9999px;
          background: conic-gradient(
            from var(--nav-angle),
            var(--nav-conic-lo)  0%,
            var(--nav-conic-hi) 12%,
            var(--nav-conic-lo) 26%,
            var(--nav-conic-lo) 68%,
            var(--nav-conic-hi) 82%,
            var(--nav-conic-lo) 100%
          );
          animation: nav-spin 8s linear infinite;
        }

        .nav-glass {
          position: relative;
          overflow: hidden;
          border-radius: 9999px;
          background: var(--glass-fill);
          backdrop-filter: blur(40px) saturate(180%) brightness(1.06);
          -webkit-backdrop-filter: blur(40px) saturate(180%) brightness(1.06);
          box-shadow:
            inset 0  1px 0 var(--glass-inset-hi),
            inset 0 -1px 0 var(--glass-inset-lo),
            0 8px 48px var(--glass-shadow);
        }

        /* Nav button — glass effect with green tint, border adapts to mode */
        .nav-button {
          background: linear-gradient(135deg, rgba(24,100,64,0.15), rgba(24,100,64,0.08));
          backdrop-filter: blur(20px) saturate(160%);
          -webkit-backdrop-filter: blur(20px) saturate(160%);
          border: 1px solid rgba(24,100,64,0.35);
          box-shadow:
            inset 0  1px 0 var(--glass-inset-hi),
            inset 0 -1px 0 var(--glass-inset-lo),
            0 4px 16px var(--glass-shadow);
        }
        .nav-button:hover {
          background: linear-gradient(135deg, rgba(24,100,64,0.25), rgba(24,100,64,0.15));
          border-color: rgba(24,100,64,0.5);
        }

        /* Caption / list pane — glass adapts to light and dark */
        .glass-pane {
          position: relative;
          border-radius: 1.7rem;
          border: 1px solid var(--glass-border-color);
          background: var(--glass-fill);
          backdrop-filter: blur(40px) saturate(180%) brightness(1.06);
          -webkit-backdrop-filter: blur(40px) saturate(180%) brightness(1.06);
          box-shadow:
            inset 0  1px 0 var(--glass-inset-hi),
            inset 0 -1px 0 var(--glass-inset-lo),
            0 8px 48px var(--glass-shadow);
        }

        .nav-shadow {
          position: absolute;
          inset: 6px;
          border-radius: 9999px;
          background: rgba(0,0,0,0.55);
          filter: blur(20px);
          transform: translateY(14px) scaleX(0.94);
          z-index: -1;
          pointer-events: none;
        }
      `}</style>
      <SpeedInsights />
      <Analytics />
    </main>
  );
}
