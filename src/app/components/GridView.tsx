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

/**
 * Grid classes applied to each independent grid container.
 * All three containers use the same classes so they produce identical layouts.
 */
const GRID_CLASSES =
  "grid grid-flow-dense auto-rows-[122px] grid-cols-3 gap-3 md:auto-rows-[150px] md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10";

/**
 * The main grid view with an infinite vertical drift animation.
 *
 * Renders three **separate, independent** grid containers — each containing
 * the same pool of items with the same spans. Because each container is its
 * own CSS Grid context, grid-flow-dense produces an identical layout in each
 * one. This guarantees that wrapping by one container's height is visually
 * seamless (no snap/jump).
 *
 * The flex gap between containers matches the internal grid row gap (gap-3)
 * so the transition between grids looks like any other row boundary.
 *
 * Users can scroll up/down to speed up, slow down, or reverse the drift.
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
    }, 450);
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

  // Three copies with distinct IDs so React keys and framer layoutIds
  // don't collide. Each copy is rendered in its own grid container.
  const [pool0, pool1, pool2] = useMemo(() => {
    const p0 = imagePool.map((w) => ({ ...w, id: `${w.id}__i0` }));
    const p1 = imagePool.map((w) => ({ ...w, id: `${w.id}__i1` }));
    const p2 = imagePool.map((w) => ({ ...w, id: `${w.id}__i2` }));
    return [p0, p1, p2] as const;
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
          className="flex flex-col gap-3 px-4 md:px-8"
          style={{
            willChange: "transform",
            transform: "translateY(0) translateZ(0)",
          }}
        >
          {/* Three independent grid containers — identical layouts */}
          <div data-grid className={GRID_CLASSES}>
            {renderTiles(pool0)}
          </div>
          <div className={GRID_CLASSES} aria-hidden="true">
            {renderTiles(pool1)}
          </div>
          <div className={GRID_CLASSES} aria-hidden="true">
            {renderTiles(pool2)}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
