/** Shared transition presets for Framer Motion. */

/** Used on all layoutId images and the modal figure for the shared-element fly-in/out. */
export const modalTransition = {
  duration: 1.08,
  ease: [0.16, 1, 0.3, 1] as const,
};

/** Used on the modal aside panel entrance and the image ring overlay. */
export const chromeTransition = {
  duration: 0.42,
  ease: [0.2, 0.8, 0.2, 1] as const,
};
