import type { Photo } from "../photoStore";

/** A Photo enriched with grid metadata for rendering in both views and the modal. */
export type PortfolioWork = Photo & { alt: string; span: string; id: string };

/** Parsed EXIF metadata shown in the modal aside panel. */
export type ExifInfo = {
  camera?: string;
  lens?: string;
  date?: string;
  exposure?: string;
  location?: string;
};
