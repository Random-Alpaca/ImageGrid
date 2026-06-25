import { CircleX, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, useCallback, useEffect } from "react";
import { modalTransition, chromeTransition } from "../lib/animations";
import { ExifDetails } from "./ExifDetails";
import type { PortfolioWork, ExifInfo } from "../types";

interface PhotoModalProps {
  selected: PortfolioWork | null;
  isClosing: boolean;
  exif: ExifInfo | null;
  onClose: () => void;
}

/**
 * How many pixels of overscroll at the bottom before we fully fade in
 * the close icon and dismiss the modal.
 */
const OVERSCROLL_THRESHOLD = 180;

/**
 * Full-screen photo modal with shared-element fly-in, blurred backdrop,
 * and an aside panel showing title, caption, and EXIF data.
 *
 * The panel is independently scrollable when its content exceeds the
 * viewport height. When the user scrolls past the bottom of the panel,
 * a CircleX icon fades in; once it reaches full opacity the modal closes.
 */
export function PhotoModal({ selected, isClosing, exif, onClose }: PhotoModalProps) {
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const [overscrollProgress, setOverscrollProgress] = useState(0);
  const isOverscrollingRef = useRef(false);
  const accumulatedOverscrollRef = useRef(0);
  const overscrollProgressRef = useRef(0);
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateProgress = useCallback((val: number) => {
    overscrollProgressRef.current = val;
    setOverscrollProgress(val);
  }, []);

  // Reset overscroll state when modal opens/closes.
  useEffect(() => {
    updateProgress(0);
    accumulatedOverscrollRef.current = 0;
    isOverscrollingRef.current = false;
    if (wheelTimeoutRef.current) {
      clearTimeout(wheelTimeoutRef.current);
    }
  }, [selected, updateProgress]);

  // Clean up timeout on unmount.
  useEffect(() => {
    return () => {
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
    };
  }, []);

  // Handle scroll events on the panel to detect overscroll at bottom.
  const handlePanelWheel = useCallback(
    (e: WheelEvent) => {
      const el = panelScrollRef.current;
      if (!el) return;

      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }

      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < 1;

      if (atBottom && e.deltaY > 0) {
        // Scrolling down past the bottom — accumulate overscroll.
        e.preventDefault();
        accumulatedOverscrollRef.current += e.deltaY;
        const progress = Math.min(
          accumulatedOverscrollRef.current / OVERSCROLL_THRESHOLD,
          1,
        );
        updateProgress(progress);
        isOverscrollingRef.current = true;
      } else if (e.deltaY < 0) {
        // Scrolling back up — reset progress immediately.
        updateProgress(0);
        accumulatedOverscrollRef.current = 0;
        isOverscrollingRef.current = false;
      } else {
        // Normal scrolling — reset any accumulated overscroll.
        updateProgress(0);
        accumulatedOverscrollRef.current = 0;
        isOverscrollingRef.current = false;
      }

      // Set the release timeout
      wheelTimeoutRef.current = setTimeout(() => {
        if (overscrollProgressRef.current >= 1) {
          onClose();
        } else {
          updateProgress(0);
          accumulatedOverscrollRef.current = 0;
          isOverscrollingRef.current = false;
        }
      }, 400);
    },
    [onClose, updateProgress],
  );

  // Attach the wheel listener (must be non-passive to preventDefault).
  useEffect(() => {
    const el = panelScrollRef.current;
    if (!el) return;
    el.addEventListener("wheel", handlePanelWheel, { passive: false });
    return () => el.removeEventListener("wheel", handlePanelWheel);
  }, [handlePanelWheel]);

  // Handle touch-based overscroll for mobile.
  const touchStartY = useRef(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const el = panelScrollRef.current;
      if (!el) return;

      const deltaY = touchStartY.current - e.touches[0].clientY;
      touchStartY.current = e.touches[0].clientY;

      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < 1;

      if (atBottom && deltaY > 0) {
        accumulatedOverscrollRef.current += deltaY;
        const progress = Math.min(
          accumulatedOverscrollRef.current / OVERSCROLL_THRESHOLD,
          1,
        );
        updateProgress(progress);
        isOverscrollingRef.current = true;
      } else if (deltaY < 0) {
        // Scrolling up - reset
        updateProgress(0);
        accumulatedOverscrollRef.current = 0;
        isOverscrollingRef.current = false;
      } else if (!isOverscrollingRef.current) {
        accumulatedOverscrollRef.current = 0;
        updateProgress(0);
      }
    },
    [updateProgress],
  );

  const handleTouchEnd = useCallback(() => {
    if (overscrollProgressRef.current >= 1) {
      onClose();
    } else {
      updateProgress(0);
      accumulatedOverscrollRef.current = 0;
      isOverscrollingRef.current = false;
    }
  }, [onClose, updateProgress]);

  return (
    <AnimatePresence>
      {selected && (
        <motion.div
          className="fixed inset-0 z-40 bg-black/0 md:bg-[rgba(0,0,0,0.55)] backdrop-blur-md"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {/*
           * Desktop: side-by-side image + scrollable panel.
           * Mobile: vertical stack — image on top, scrollable panel below.
           */}
          <div className="flex h-full w-full flex-col items-center justify-start py-[3vh] px-[5vw] gap-[3vh] md:flex-row md:items-center md:justify-center md:gap-8 md:p-4">
            {/* ── Image ─────────────────────────────────────── */}
            <motion.figure
              className="relative mx-auto max-h-[38vh] w-full shrink-0 overflow-hidden bg-black shadow-2xl shadow-black/70 md:mx-0 md:max-h-[84vh] md:max-w-[calc(100%-390px-4rem)] md:w-auto"
              layout
              transition={modalTransition}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.img
                layoutId={`portfolio-image-${selected.id}`}
                src={selected.src}
                alt={selected.alt}
                className="block max-h-[40vh] w-full object-contain md:max-h-[84vh] md:w-auto md:max-w-full"
                transition={modalTransition}
              />
              <AnimatePresence>
                {!isClosing && (
                  <motion.div
                    className="pointer-events-none absolute inset-0 ring-1 ring-white/15"
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: 1,
                      transition: { ...chromeTransition, delay: 0.82 },
                    }}
                    exit={{
                      opacity: 0,
                      transition: { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] },
                    }}
                  />
                )}
              </AnimatePresence>
            </motion.figure>

            {/* ── Scrollable panel ─────────────────────────── */}
            <AnimatePresence>
              {!isClosing && (
                <motion.div
                  className="relative flex min-h-0 w-full flex-1 md:flex-initial md:h-[84vh] md:w-[390px] md:shrink-0"
                  initial={{ opacity: 0, x: 28, scale: 0.96 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    scale: 1,
                    transition: { ...chromeTransition, delay: 0.92 },
                  }}
                  exit={{
                    opacity: 0,
                    x: 18,
                    scale: 0.97,
                    transition: { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] },
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    ref={panelScrollRef}
                    className="glass-pane flex-1 overflow-y-auto overscroll-contain p-6 md:p-7"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                  >
                    <button
                      onClick={onClose}
                      className="mb-7 ml-auto grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
                    >
                      <X className="size-5" />
                    </button>
                    <h3
                      className="text-5xl font-medium leading-[0.95] tracking-[-0.02em]"
                      style={{ textShadow: "0 1px 12px rgba(0,0,0,0.6)" }}
                    >
                      {selected.title}
                    </h3>
                    <p className="mt-6 leading-7 text-white/75">{selected.caption}</p>
                    {exif && <ExifDetails exif={exif} />}

                    {/* Overscroll close indicator — sits at the very bottom */}
                    <div className="mt-10 flex justify-center pb-2">
                      <CircleX
                        className="size-8 text-white/60 transition-transform"
                        style={{
                          opacity: overscrollProgress,
                          transform: `scale(${0.6 + overscrollProgress * 0.4})`,
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
