import { motion } from "motion/react";

interface TopScrimProps {
  expanded: boolean;
}

/**
 * Fixed-position gradient scrim at the top of the page.
 * The solid black portion animates taller when the categories panel is open.
 */
export function TopScrim({ expanded }: TopScrimProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex flex-col">
      <motion.div
        className="w-full bg-black"
        initial={{ height: 55 }}
        animate={{ height: expanded ? 200 : 55 }}
        transition={{
          duration: expanded ? 0.3 : 0.22,
          ease: [0.2, 0.8, 0.2, 1],
        }}
      />
      <div className="h-[85px] w-full bg-gradient-to-b from-black to-transparent" />
    </div>
  );
}
