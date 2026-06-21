import { useState } from "react";
import { motion } from "motion/react";
import { GridTile } from "./GridTile";
import type { PortfolioWork } from "../types";

interface GridViewProps {
  imagePool: PortfolioWork[];
  isPaused: boolean;
  onSelect: (work: PortfolioWork) => void;
}

/**
 * The main grid view with an infinite vertical drift animation.
 * Contains the dense CSS grid of tiles with a bottom fade gradient.
 */
export function GridView({ imagePool, isPaused, onSelect }: GridViewProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  // Pause the drift when a tile is hovered.
  const effectivePaused = isPaused || hovered !== null;

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
          className="drift-animation px-4 md:px-8"
          style={{
            willChange: "transform",
            transform: "translateZ(0)",
            animationPlayState: effectivePaused ? "paused" : "running",
          }}
        >
          <div
            data-grid
            className="grid grid-flow-dense auto-rows-[122px] grid-cols-3 gap-3 pt-4 md:auto-rows-[150px] md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
          >
            {imagePool.map((work) => (
              <GridTile
                key={work.id}
                work={work}
                isHovered={hovered === work.id}
                isDimmed={hovered !== null && hovered !== work.id}
                onHover={(_e, id) => setHovered(id)}
                onUnhover={() => setHovered(null)}
                onClick={() => onSelect(work)}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
