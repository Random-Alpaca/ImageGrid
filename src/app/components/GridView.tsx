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

/** Shared CSS grid classes — must be identical for layout continuity. */
const GRID_CLASSES =
  "grid grid-flow-dense auto-rows-[122px] grid-cols-3 gap-3 md:auto-rows-[150px] md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 px-4 md:px-8";

/**
 * The main grid view with an infinite vertical drift animation.
 * Renders three consecutive iterations of the image pool in a single
 * continuous grid flow to eliminate any layout gaps or seams.
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

  const driftRef = useDriftSpeed(effectivePaused, imagePool.length, handleScroll);

  // Generate 3 iterations of the pool with distinct suffixes.
  const extendedPool = useMemo(() => {
    const iter0 = imagePool.map((w) => ({ ...w, id: `${w.id}__i0` }));
    const iter1 = imagePool.map((w) => ({ ...w, id: `${w.id}__i1` }));
    const iter2 = imagePool.map((w) => ({ ...w, id: `${w.id}__i2` }));
    return [...iter0, ...iter1, ...iter2];
  }, [imagePool]);

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
          data-grid
          className={GRID_CLASSES}
          style={{
            willChange: "transform",
            transform: "translateY(0) translateZ(0)",
          }}
        >
          {renderTiles(extendedPool)}
        </div>
      </div>
    </motion.section>
  );
}
