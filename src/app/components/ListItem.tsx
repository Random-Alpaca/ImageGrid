import { motion } from "motion/react";
import { modalTransition } from "../lib/animations";
import type { PortfolioWork } from "../types";

interface ListItemProps {
  item: PortfolioWork;
  onClick: () => void;
}

/** A single row in the list view: thumbnail + info pane. */
export function ListItem({ item, onClick }: ListItemProps) {
  return (
    <button key={item.id} onClick={onClick} className="w-full text-left">
      <div className="flex items-stretch gap-4 p-2 transition-colors hover:bg-white/[0.03]">
        {/* Thumbnail */}
        <div className="relative h-40 w-32 shrink-0 overflow-hidden bg-black shadow-xl shadow-black/60 ring-1 ring-white/10 md:h-48 md:w-40">
          <motion.img
            layoutId={`portfolio-image-${item.id}`}
            src={item.src}
            alt={item.alt}
            loading="lazy"
            className="size-full object-cover"
            transition={modalTransition}
          />
        </div>
        {/* Info pane */}
        <div className="glass-pane flex flex-1 flex-col justify-center p-5 md:p-6">
          <h3
            className="text-2xl font-medium leading-tight tracking-[-0.02em]"
            style={{ color: "var(--glass-text)" }}
          >
            {item.title}
          </h3>
          <p
            className="mt-2 text-sm leading-6"
            style={{ color: "var(--glass-text-muted)" }}
          >
            {item.caption}
          </p>
        </div>
      </div>
    </button>
  );
}
