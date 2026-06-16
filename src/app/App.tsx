import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import { fetchPhotos, staticPhotos, type Photo } from "../photoStore";

// Varied tile footprints so the grid never reads as a uniform sheet.
const sizeCycle = [
  "col-span-1 row-span-1",
  "col-span-2 row-span-2",
  "col-span-1 row-span-2",
  "col-span-1 row-span-1",
  "col-span-2 row-span-1",
  "col-span-1 row-span-1",
  "col-span-1 row-span-2",
];

type PortfolioWork = Photo & { alt: string; span: string; id: string };

// Repeat the photos to fill a dense grid so even a few images look full.
function buildImagePool(source: Photo[]): PortfolioWork[] {
  if (source.length === 0) return [];
  return Array.from({ length: 72 }, (_, index) => {
    const photo = source[index % source.length];
    return {
      ...photo,
      alt: photo.alt ?? photo.title,
      span: sizeCycle[index % sizeCycle.length],
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
  const [selected, setSelected] = useState<PortfolioWork | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [origin, setOrigin] = useState("center center");

  // The grid drift and the nav's spinning glass border both pause together so
  // the glass freezes in sync with the photos it's refracting.
  const isPaused = hovered !== null || selected !== null;

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
    <main className="h-screen overflow-hidden bg-black text-foreground selection:bg-primary selection:text-primary-foreground">

      {/* Outer wrapper — owns fixed positioning and the spinning conic gradient border */}
      <div className="nav-wrap" style={{ animationPlayState: isPaused ? "paused" : "running" }}>
        <nav className="nav-glass flex items-center justify-between px-4 py-3 text-white md:px-6">
          {/* Dome highlight — convex lens catching light from above */}
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,255,255,0.22) 0%, transparent 70%)" }} />
          {/* Bottom vignette — shadow inside the dome */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5" style={{ background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.12))" }} />
          <div className="relative flex items-center gap-3"><span className="text-xl font-medium" style={{ textShadow: "0 1px 12px rgba(0,0,0,0.7), 0 0 40px rgba(0,0,0,0.4)" }}>Jacky Xue</span></div>
          <a href="https://jxue.ca" className="relative flex items-center gap-2 rounded-full bg-[#efe2c6] px-4 py-2 text-sm text-[#17130f] transition hover:scale-105">jxue.ca</a>
        </nav>
        {/* Lifted shadow — blurred copy below for the floating 3-D look */}
        <div className="nav-shadow" />
      </div>

      <section className="relative z-10 mx-auto flex h-screen w-full max-w-[1800px] flex-col">
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
                    className={`${work.span} group/card relative min-h-0 overflow-hidden rounded-[1.15rem] bg-black text-left shadow-sm transition-[border-radius,box-shadow] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] hover:rounded-[1.6rem] hover:shadow-2xl hover:shadow-[rgba(0,0,0,0.45)] focus:outline-none focus:ring-2 focus:ring-primary`}
                  >
                    <motion.img
                      layoutId={`portfolio-image-${work.id}`}
                      src={work.src}
                      alt={work.alt}
                      className="size-full object-cover"
                      transition={modalTransition}
                    />
                    <div
                      className="absolute inset-0 bg-black transition-opacity duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
                      style={{ opacity: isDimmed ? 0.6 : 0 }}
                    />
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

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
                    <button onClick={closeModal} className="mb-7 ml-auto grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"><X className="size-5" /></button>
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
            rgba(255,255,255,0.03) 0%,
            rgba(255,255,255,0.7)  12%,
            rgba(255,255,255,0.03) 26%,
            rgba(255,255,255,0.03) 68%,
            rgba(255,255,255,0.5)  82%,
            rgba(255,255,255,0.03) 100%
          );
          animation: nav-spin 8s linear infinite;
        }

        .nav-glass {
          position: relative;
          overflow: hidden;
          border-radius: 9999px;
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(40px) saturate(200%) brightness(1.08);
          -webkit-backdrop-filter: blur(40px) saturate(200%) brightness(1.08);
          box-shadow:
            inset 0  1px 0 rgba(255,255,255,0.35),
            inset 0 -1px 0 rgba(0,0,0,0.18),
            0 8px 48px rgba(0,0,0,0.45);
        }

        /* Caption pane — same glass recipe as the nav bar */
        .glass-pane {
          position: relative;
          border-radius: 1.7rem;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(40px) saturate(200%) brightness(1.08);
          -webkit-backdrop-filter: blur(40px) saturate(200%) brightness(1.08);
          box-shadow:
            inset 0  1px 0 rgba(255,255,255,0.35),
            inset 0 -1px 0 rgba(0,0,0,0.18),
            0 8px 48px rgba(0,0,0,0.45);
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
