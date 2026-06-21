import { useState } from "react";
import { motion } from "motion/react";
import { EXPAND } from "../lib/imagePool";
import { modalTransition } from "../lib/animations";
import type { PortfolioWork } from "../types";

interface GridTileProps {
  work: PortfolioWork;
  isHovered: boolean;
  isDimmed: boolean;
  onHover: (e: React.MouseEvent<HTMLElement>, id: string) => void;
  onUnhover: () => void;
  onClick: () => void;
}

/**
 * A single grid tile that expands into the gap on hover, revealing more of
 * the image without scaling. The expansion respects grid edges.
 */
export function GridTile({ work, isHovered, isDimmed, onHover, onUnhover, onClick }: GridTileProps) {
  const [expandEdges, setExpandEdges] = useState({ left: true, right: true });

  const handleEnter = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const gb = e.currentTarget.closest("[data-grid]")?.getBoundingClientRect();
    setExpandEdges({
      left: !gb || rect.left > gb.left + 2,
      right: !gb || rect.right < gb.right - 2,
    });
    onHover(e, work.id);
  };

  return (
    <motion.button
      key={work.id}
      onMouseEnter={handleEnter}
      onMouseLeave={onUnhover}
      onFocus={handleEnter}
      onBlur={onUnhover}
      onClick={onClick}
      style={{ zIndex: isHovered ? 20 : 1 }}
      className={`${work.span} group/card relative min-h-0 bg-muted text-left focus:outline-none focus:ring-2 focus:ring-primary`}
    >
      {/* Inner div expands into the gap via inset; overflow-hidden clips the image */}
      <div
        className="absolute overflow-hidden"
        style={{
          top: isHovered ? `-${EXPAND}px` : "0px",
          right: isHovered && expandEdges.right ? `-${EXPAND}px` : "0px",
          bottom: isHovered ? `-${EXPAND}px` : "0px",
          left: isHovered && expandEdges.left ? `-${EXPAND}px` : "0px",
          boxShadow: isHovered ? "0 8px 40px rgba(0,0,0,0.5)" : "none",
          transition:
            "top 0.35s cubic-bezier(0.2,0.8,0.2,1), right 0.35s cubic-bezier(0.2,0.8,0.2,1), bottom 0.35s cubic-bezier(0.2,0.8,0.2,1), left 0.35s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.35s cubic-bezier(0.2,0.8,0.2,1)",
        }}
      >
        {/* Inverse-inset wrapper keeps the image at constant size while the clip expands */}
        <div
          className="absolute"
          style={{
            top: isHovered ? "0px" : `-${EXPAND}px`,
            right: isHovered && expandEdges.right ? "0px" : `-${EXPAND}px`,
            bottom: isHovered ? "0px" : `-${EXPAND}px`,
            left: isHovered && expandEdges.left ? "0px" : `-${EXPAND}px`,
            transition:
              "top 0.35s cubic-bezier(0.2,0.8,0.2,1), right 0.35s cubic-bezier(0.2,0.8,0.2,1), bottom 0.35s cubic-bezier(0.2,0.8,0.2,1), left 0.35s cubic-bezier(0.2,0.8,0.2,1)",
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

        {/* Dim overlay for non-hovered tiles */}
        <div
          className="absolute inset-0 transition-opacity duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{
            opacity: isDimmed ? 0.55 : 0,
            background: "var(--dim-overlay)",
          }}
        />
      </div>
    </motion.button>
  );
}
