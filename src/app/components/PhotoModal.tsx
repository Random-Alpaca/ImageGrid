import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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
 * Full-screen photo modal with shared-element fly-in, blurred backdrop,
 * and an aside panel showing title, caption, and EXIF data.
 */
export function PhotoModal({ selected, isClosing, exif, onClose }: PhotoModalProps) {
  return (
    <AnimatePresence>
      {selected && (
        <motion.div
          className="fixed inset-0 z-40 grid place-items-center bg-[rgba(0,0,0,0.55)] p-4 backdrop-blur-md"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="flex h-[88vh] w-full max-w-6xl flex-col items-center justify-center gap-4 md:grid md:grid-cols-[minmax(0,1fr)_390px] md:gap-8">
            {/* Figure hugs the photo's native proportions */}
            <motion.figure
              className="relative max-h-[58vh] max-w-full overflow-hidden bg-black shadow-2xl shadow-black/70 md:ml-auto md:max-h-[84vh] md:max-w-full"
              layout
              transition={modalTransition}
              onClick={(e) => e.stopPropagation()}
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

            {/* Aside panel with title, caption, EXIF */}
            <AnimatePresence>
              {!isClosing && (
                <motion.aside
                  className="glass-pane w-full max-w-[390px] p-6 text-white md:relative md:w-[390px] md:p-7"
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
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
