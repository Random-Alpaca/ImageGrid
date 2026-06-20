// ─────────────────────────────────────────────────────────────────────────
// YOUR PHOTOS
//
// Add one entry per photo. To add a photo:
//   1. Set `src` to either
//        • an external image URL  ->  "https://your-host.com/photo.jpg"
//          (any host works: your own CDN, S3, Cloudinary, imgur, etc.)
//        • OR a local file you dropped in `public/photos/`  ->  "/photos/photo.jpg"
//   2. Give it a `title` and a `caption` (shown in the pop-up).
//   3. `alt` is optional accessibility text; it defaults to the title.
//
// The grid repeats your photos to fill the screen, so even a few look great.
// ─────────────────────────────────────────────────────────────────────────

export type Photo = {
  src: string;
  title: string;
  caption: string;
  alt?: string;
  location?: string;
  // Subportfolios this photo belongs to. Absent/empty → "Uncategorized".
  portfolios?: string[];
};

export const photos: Photo[] = [
  {
    src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=900&h=1100&fit=crop&auto=format",
    title: "Untitled",
    caption: "Replace this with your own photo, title, and caption.",
  },
];
