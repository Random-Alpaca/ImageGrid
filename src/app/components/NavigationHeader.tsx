import { Folders, LayoutGrid, LayoutList } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

interface NavigationHeaderProps {
  portfolioNames: string[];
  hidden: Set<string>;
  portfoliosOpen: boolean;
  setPortfoliosOpen: (open: boolean) => void;
  togglePortfolio: (name: string) => void;
  view: "grid" | "list";
  onToggleView: () => void;
}

/**
 * Fixed navigation header with branding, view toggle, and the
 * Apple-inspired categories dropdown that expands on hover.
 */
export function NavigationHeader({
  portfolioNames,
  hidden,
  portfoliosOpen,
  setPortfoliosOpen,
  togglePortfolio,
  view,
  onToggleView,
}: NavigationHeaderProps) {
  return (
    <>
      <header
        className="fixed inset-x-4 top-5 z-30 mx-auto max-w-4xl text-white"
        style={{ textShadow: "0 1px 12px rgba(0,0,0,0.35)" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xl font-medium">Jacky Xue</span>
          <div className="flex items-center gap-1">
            {portfolioNames.length > 0 && (
              <button
                onMouseEnter={() => setPortfoliosOpen(true)}
                onClick={() => setPortfoliosOpen(!portfoliosOpen)}
                className="flex items-center justify-center rounded-full p-2 text-white/75 transition hover:text-white"
                aria-label="Categories"
                aria-expanded={portfoliosOpen}
              >
                <Folders className="size-4" />
              </button>
            )}
            <button
              onClick={onToggleView}
              className="flex items-center justify-center rounded-full p-2 text-white/75 transition hover:text-white"
              aria-label="Toggle view"
            >
              {view === "grid" ? (
                <LayoutGrid className="size-4" />
              ) : (
                <LayoutList className="size-4" />
              )}
            </button>
            <a
              href="https://jxue.ca"
              className="rounded-full px-3 py-2 text-sm text-white/75 transition hover:text-white"
            >
              Home
            </a>
          </div>
        </div>

        {/* Categories panel — expands downward from the nav */}
        <AnimatePresence>
          {portfoliosOpen && portfolioNames.length > 0 && (
            <motion.div
              key="categories-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{
                height: "auto",
                opacity: 1,
                transition: {
                  height: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] },
                  opacity: { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] },
                },
              }}
              exit={{
                height: 0,
                opacity: 0,
                transition: {
                  height: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] },
                  opacity: { duration: 0.14, ease: [0.2, 0.8, 0.2, 1] },
                },
              }}
              className="overflow-hidden"
              style={{ textShadow: "none" }}
            >
              <div className="pb-3 pt-4">
                <motion.h4
                  initial={{ opacity: 0, y: -4 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.2, delay: 0.06, ease: [0.2, 0.8, 0.2, 1] },
                  }}
                  exit={{
                    opacity: 0,
                    y: -4,
                    transition: { duration: 0.15, ease: [0.2, 0.8, 0.2, 1] },
                  }}
                  className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40"
                >
                  Categories
                </motion.h4>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {portfolioNames.map((name, i) => {
                    const active = !hidden.has(name);
                    return (
                      <motion.button
                        key={name}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          transition: {
                            duration: 0.22,
                            delay: 0.04 + i * 0.035,
                            ease: [0.2, 0.8, 0.2, 1],
                          },
                        }}
                        exit={{
                          opacity: 0,
                          y: -6,
                          transition: { duration: 0.15, ease: [0.2, 0.8, 0.2, 1] },
                        }}
                        onClick={() => togglePortfolio(name)}
                        aria-pressed={active}
                        className={`py-1 text-sm transition-colors duration-200 ${
                          active ? "text-white" : "text-white/35 hover:text-white/55"
                        }`}
                      >
                        {name}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Invisible backdrop to close the panel on click outside */}
      {portfoliosOpen && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setPortfoliosOpen(false)}
        />
      )}
    </>
  );
}
