import { useEffect, useMemo, useState, useRef } from "react";
import exifr from "exifr";
import { Folders, LayoutGrid, LayoutList, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import { fetchPhotos, staticPhotos, type Photo } from "../photoStore";

const UNCATEGORIZED = "Uncategorized";
const photoPortfolios = (p: Photo): string[] =>
  p.portfolios && p.portfolios.length > 0 ? p.portfolios : [UNCATEGORIZED];

const POOL_SIZE = 72;
const EXPAND = 8; // px into the 12px gap; leaves 4px margin so expanded tiles don't feel like they're touching
const SEED = 0x9e3779b9; // fixed → layout is deterministic and stable across renders

// Varied tile footprints, weighted so big tiles stay a minority and grid-flow-dense
// still backfills cleanly. Picked at random (seeded) so the size rhythm never repeats.
const SPAN_WEIGHTS = [
  { span: "col-span-1 row-span-1", w: 40 },
  { span: "col-span-2 row-span-1", w: 20 },
  { span: "col-span-1 row-span-2", w: 20 },
  { span: "col-span-2 row-span-2", w: 20 },
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

function pickSpan(rng: () => number): string {
  let r = rng() * SPAN_TOTAL;
  for (const s of SPAN_WEIGHTS) {
    if (r < s.w) return s.span;
    r -= s.w;
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

const modalTransition = {
  duration: 1.08,
  ease: [0.16, 1, 0.3, 1] as const,
};

const chromeTransition = {
  duration: 0.42,
  ease: [0.2, 0.8, 0.2, 1] as const,
};

const panelVariants = {
  hidden: { opacity: 0, y: -8, scale: 0.95, transition: { duration: 0.16, ease: [0.2, 0.8, 0.2, 1] as const } },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] as const, staggerChildren: 0.035, delayChildren: 0.04 },
  },
};
const panelItemVariants = {
  hidden: { opacity: 0, x: 8 },
  visible: { opacity: 1, x: 0 },
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
  // Track *hidden* portfolios, not selected ones: empty = everything shows, and a
  // newly-published portfolio appears by default with no re-sync when photoList loads.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [portfoliosOpen, setPortfoliosOpen] = useState(false);

  // Sorted union of every photo's portfolios (Uncategorized included when any photo is unassigned).
  const portfolioNames = useMemo(() => {
    const names = new Set<string>();
    for (const p of photoList) for (const name of photoPortfolios(p)) names.add(name);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [photoList]);

  // A photo shows if at least one of its portfolios is not hidden.
  const filteredPhotos = useMemo(
    () => photoList.filter((p) => photoPortfolios(p).some((name) => !hidden.has(name))),
    [photoList, hidden],
  );

  const imagePool = useMemo(() => buildImagePool(filteredPhotos), [filteredPhotos]);
  const listPool = useMemo<PortfolioWork[]>(() =>
    filteredPhotos.map((photo, i) => ({
      ...photo,
      alt: photo.alt ?? photo.title,
      span: "",
      id: `list-${photo.title}-${i}`,
    })),
    [filteredPhotos]
  );
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<PortfolioWork | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [expandEdges, setExpandEdges] = useState({ left: true, right: true });

  type ExifInfo = { camera?: string; lens?: string; date?: string; exposure?: string; location?: string };
  const [exif, setExif] = useState<ExifInfo | null>(null);
  const exifAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    setExif(null);
    if (!selected) return;
    const ctrl = new AbortController();
    exifAbort.current?.abort();
    exifAbort.current = ctrl;

    const PICK = { pick: ["Make", "Model", "LensModel", "FocalLength", "FocalLengthIn35mmFilm", "FNumber", "ExposureTime", "ISO", "DateTimeOriginal", "latitude", "longitude"], gps: true };
    // Try direct parse first (works if CDN sends CORS headers); fall back to API proxy.
    const parseViaApi = () => fetch(`/api/exif?url=${encodeURIComponent(selected.src)}`, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : null).catch(() => null);

    Promise.resolve()
      .then(() => exifr.parse(selected.src, PICK).catch(() => null))
      .then(direct => direct ?? parseViaApi())
      .then(async (raw) => {
      if (ctrl.signal.aborted || !raw) return;

      const camera = [raw.Make, raw.Model].filter(Boolean).join(" ") || undefined;
      const lens = raw.LensModel as string | undefined;

      let date: string | undefined;
      const dto = raw.DateTimeOriginal;
      if (dto) {
        const d = dto instanceof Date ? dto : new Date(dto as string);
        if (!isNaN(d.getTime())) date = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(d);
      }

      const toTwoSigFigs = (val: number): number => {
        if (typeof val !== "number" || isNaN(val)) return val;
        return Number(val.toPrecision(2));
      };

      const expParts: string[] = [];
      const fl = raw.FocalLengthIn35mmFilm ?? raw.FocalLength;
      if (fl) expParts.push(`${toTwoSigFigs(fl)}mm`);
      if (raw.FNumber) expParts.push(`f/${toTwoSigFigs(raw.FNumber)}`);
      if (raw.ExposureTime) {
        if (raw.ExposureTime < 1) {
          expParts.push(`1/${toTwoSigFigs(Math.round(1 / raw.ExposureTime))}s`);
        } else {
          expParts.push(`${toTwoSigFigs(raw.ExposureTime)}s`);
        }
      }
      if (raw.ISO) expParts.push(`ISO ${toTwoSigFigs(raw.ISO)}`);
      const exposure = expParts.length ? expParts.join(" · ") : undefined;

      // Prefer the manually-set location from the Photo object; fall back to GPS reverse-geocode.
      let location: string | undefined = selected.location;
      if (!location && raw.latitude && raw.longitude) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${raw.latitude}&lon=${raw.longitude}&format=json`, { signal: ctrl.signal, headers: { "Accept-Language": "en" } });
          const geo = await res.json();
          const a = geo.address ?? {};
          location = [a.city ?? a.town ?? a.village ?? a.county, a.country].filter(Boolean).join(", ");
        } catch { /* no GPS or blocked */ }
      }

      if (!ctrl.signal.aborted) setExif({ camera, lens, date, exposure, location });
    }).catch(() => {});
  }, [selected?.src]);

  const handleEnter = (e: React.MouseEvent<HTMLElement>, id: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const gb = e.currentTarget.closest("[data-grid]")?.getBoundingClientRect();
    setExpandEdges({ left: !gb || rect.left > gb.left + 2, right: !gb || rect.right < gb.right - 2 });
    setHovered(id);
  };

  // The grid drift and the nav's spinning glass border both pause together so
  // the glass freezes in sync with the photos it's refracting.
  const isPaused = hovered !== null || selected !== null;

  const toggleView = () => {
    setSelected(null);
    setIsClosing(false);
    setHovered(null);
    setView(v => v === "grid" ? "list" : "grid");
  };

  const togglePortfolio = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  useEffect(() => {
    if (!portfoliosOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPortfoliosOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [portfoliosOpen]);

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


  return (
    <main className="h-screen overflow-hidden bg-background text-foreground selection:bg-primary selection:text-primary-foreground">


      {/* Bare floating header — controls float over the scrim */}
      <header
        className="fixed inset-x-4 top-5 z-30 mx-auto flex max-w-4xl items-center justify-between text-white"
        style={{ textShadow: "0 1px 12px rgba(0,0,0,0.35)" }}
      >
        <span className="text-xl font-medium">Jacky Xue</span>
        <div className="relative flex items-center gap-1">
          {portfolioNames.length > 0 && (
            <button onClick={() => setPortfoliosOpen((o) => !o)} className="flex items-center justify-center rounded-full p-2 text-white/75 transition hover:text-white" aria-label="Portfolios" aria-expanded={portfoliosOpen}>
              <Folders className="size-4" />
            </button>
          )}
          <button onClick={toggleView} className="flex items-center justify-center rounded-full p-2 text-white/75 transition hover:text-white" aria-label="Toggle view">
            {view === "grid" ? <LayoutGrid className="size-4" /> : <LayoutList className="size-4" />}
          </button>
          <a href="https://jxue.ca" className="rounded-full px-3 py-2 text-sm text-white/75 transition hover:text-white">Home</a>

          {/* Portfolios dropdown — anchored to the control cluster */}
          <AnimatePresence>
            {portfoliosOpen && portfolioNames.length > 0 && (
              <motion.div
                key="portfolios-panel"
                variants={panelVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="glass-pane w-56 origin-top-right p-2"
                style={{ position: "absolute", top: "calc(100% + 0.5rem)", right: 0, color: "var(--glass-text)", zIndex: 40, textShadow: "none" }}
              >
                {portfolioNames.map((name) => {
                  const active = !hidden.has(name);
                  return (
                    <motion.button
                      key={name}
                      variants={panelItemVariants}
                      onClick={() => togglePortfolio(name)}
                      aria-pressed={active}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors ${active ? "bg-white/[0.12] text-white" : "text-white/40 hover:bg-white/[0.06] hover:text-white/70"}`}
                    >
                      {name}
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>
      {portfoliosOpen && <div className="fixed inset-0 z-20" onClick={() => setPortfoliosOpen(false)} />}

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
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20" style={{ height: 140, background: "linear-gradient(to bottom, black 0%, black 55px, transparent 140px)" }} />
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
                        onMouseEnter={(e) => handleEnter(e, work.id)}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={(e) => handleEnter(e, work.id)}
                        onBlur={() => setHovered(null)}
                        onClick={() => openModal(work)}
                        style={{ zIndex: isExpanded ? 20 : 1 }}
                        className={`${work.span} group/card relative min-h-0 bg-muted text-left focus:outline-none focus:ring-2 focus:ring-primary`}
                      >
                        {/* Inner div expands into the gap via inset; overflow-hidden lives here so the image fills the expanded area */}
                        <div
                          className="absolute overflow-hidden"
                          style={{
                            top: isExpanded ? `-${EXPAND}px` : "0px",
                            right: isExpanded && expandEdges.right ? `-${EXPAND}px` : "0px",
                            bottom: isExpanded ? `-${EXPAND}px` : "0px",
                            left: isExpanded && expandEdges.left ? `-${EXPAND}px` : "0px",
                            boxShadow: isExpanded ? "0 8px 40px rgba(0,0,0,0.5)" : "none",
                            transition: "top 0.35s cubic-bezier(0.2,0.8,0.2,1), right 0.35s cubic-bezier(0.2,0.8,0.2,1), bottom 0.35s cubic-bezier(0.2,0.8,0.2,1), left 0.35s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.35s cubic-bezier(0.2,0.8,0.2,1)",
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              transform: isExpanded ? 'scale(1)' : 'scale(1.12)',
                              transition: 'transform 0.35s cubic-bezier(0.2,0.8,0.2,1)',
                            }}
                          >
                            <motion.img
                              layoutId={`portfolio-image-${work.id}`}
                              src={work.src}
                              alt={work.alt}
                              className="size-full object-cover"
                              transition={modalTransition}
                            />
                          </div>
                          <div
                            className="absolute inset-0 transition-opacity duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
                            style={{ opacity: isDimmed ? 0.55 : 0, background: "var(--dim-overlay)" }}
                          />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.section>
        ) : (
          <section
            key="list"
            className="relative z-10 h-screen overflow-y-auto bg-background"
          >
            <div className="mx-auto max-w-3xl space-y-3 px-4 pb-12 pt-28 md:px-8">
              {listPool.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openModal(item)}
                  className="w-full text-left"
                >
                  <div className="flex items-stretch gap-4 p-2 transition-colors hover:bg-white/[0.03]">
                    {/* Thumbnail */}
                    <div className="relative h-40 w-32 shrink-0 overflow-hidden bg-black shadow-xl shadow-black/60 ring-1 ring-white/10 md:h-48 md:w-40">
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
                </button>
              ))}
            </div>
          </section>
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
                className="relative max-h-[58vh] max-w-full overflow-hidden bg-black shadow-2xl shadow-black/70 md:ml-auto md:max-h-[84vh] md:max-w-full"
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
                      className="pointer-events-none absolute inset-0 ring-1 ring-white/15"
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
                    <button onClick={closeModal} className="mb-7 ml-auto grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"><X className="size-5" /></button>
                    <h3 className="text-5xl font-medium leading-[0.95] tracking-[-0.02em]" style={{ textShadow: "0 1px 12px rgba(0,0,0,0.6)" }}>{selected.title}</h3>
                    <p className="mt-6 leading-7 text-white/75">{selected.caption}</p>
                    {exif && (exif.camera || exif.exposure || exif.date || exif.location) && (
                      <dl className="mt-7 border-t border-white/10 pt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
                        {exif.camera && <><dt className="text-white/40 pt-px">Camera</dt><dd className="text-white/70">{exif.camera}</dd></>}
                        {exif.lens && <><dt className="text-white/40 pt-px">Lens</dt><dd className="text-white/70">{exif.lens}</dd></>}
                        {exif.exposure && <><dt className="text-white/40 pt-px">Exposure Details</dt><dd className="text-white/70">{exif.exposure}</dd></>}
                        {exif.date && <><dt className="text-white/40 pt-px">Date</dt><dd className="text-white/70">{exif.date}</dd></>}
                        {exif.location && <><dt className="text-white/40 pt-px">Location</dt><dd className="text-white/70">{exif.location}</dd></>}
                      </dl>
                    )}
                  </motion.aside>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes drift { from { transform: translateY(0); } to { transform: translateY(-50%); } }

        /* Caption / list pane / portfolios dropdown — glass adapts to light and dark */
        .glass-pane {
          position: relative;
          border-radius: 0;
          background: #111;
          border: 1px solid rgba(255,255,255,0.07);
        }
      `}</style>
      <SpeedInsights />
      <Analytics />
    </main>
  );
}
