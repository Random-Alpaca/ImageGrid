import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { GridTile } from "./GridTile";
import { useDriftSpeed } from "../hooks/useDriftSpeed";
import type { PortfolioWork } from "../types";

interface GridViewProps {
  imagePool: PortfolioWork[];
  isPaused: boolean;
  onSelect: (work: PortfolioWork) => void;
}

/** Shared CSS grid classes — must be identical for both copies. */
const GRID_CLASSES =
  "grid grid-flow-dense auto-rows-[122px] grid-cols-3 gap-3 md:auto-rows-[150px] md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10";

/**
 * The main grid view with an infinite vertical drift animation.
 * Renders two identical copies of the tile grid so that the drift
 * wraps seamlessly — one copy is always on-screen as the other scrolls off.
 *
 * Users can scroll up/down to temporarily speed up, slow down, or reverse
 * the drift. The speed decays back to normal after a moment.
 */
export function GridView({ imagePool, isPaused, onSelect }: GridViewProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const scrollTimeoutRef = useRef<any>(null);
  const isScrollingRef = useRef(false);

  // Exit hover/dimmed state when scrolling and prevent immediate re-hovering.
  const handleScroll = useCallback(() => {
    setHovered(null);
    isScrollingRef.current = true;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 450); // Cooldown to allow scroll movement to settle before re-enabling hovers
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleHover = useCallback((id: string) => {
    if (isScrollingRef.current) return;
    setHovered(id);
  }, []);

  const handleUnhover = useCallback(() => setHovered(null), []);

  // Pause the drift when a tile is hovered.
  const effectivePaused = isPaused || hovered !== null;

  const driftRef = useDriftSpeed(effectivePaused, handleScroll);

  // Second copy with distinct IDs so React keys and framer layoutIds
  // don't collide with the primary copy.
  const duplicatePool = useMemo(
    () => imagePool.map((w) => ({ ...w, id: `${w.id}__dup` })),
    [imagePool],
  );

  const renderTiles = (pool: PortfolioWork[]) =>
    pool.map((work) => (
      <GridTile
        key={work.id}
        work={work}
        isHovered={hovered === work.id}
        isDimmed={hovered !== null && hovered !== work.id}
        onHover={handleHover}
        onUnhover={handleUnhover}
        onSelect={onSelect}
      />
    ));

  return (
    <motion.section
      key="grid"
      className="relative z-10 mx-auto flex h-screen w-full max-w-[1800px] flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-28 bg-gradient-to-t from-black to-transparent" />
        <div
          ref={driftRef}
          className="px-4 md:px-8"
          style={{
            willChange: "transform",
            transform: "translateY(0) translateZ(0)",
          }}
        >
          {/* Primary copy */}
          <div data-grid className={GRID_CLASSES}>
            {renderTiles(imagePool)}
          </div>
          {/* Seamless duplicate — mt-3 matches the internal row gap-3 */}
          <div className={`${GRID_CLASSES} mt-3`} aria-hidden="true">
            {renderTiles(duplicatePool)}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
