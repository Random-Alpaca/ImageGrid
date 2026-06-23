import { useEffect, useMemo, useState } from "react";
import { fetchPhotos, staticPhotos, type Photo } from "../../photoStore";
import { buildImagePool } from "../lib/imagePool";
import type { PortfolioWork } from "../types";

const UNCATEGORIZED = "Uncategorized";
const photoPortfolios = (p: Photo): string[] =>
  p.portfolios && p.portfolios.length > 0 ? p.portfolios : [UNCATEGORIZED];

/**
 * Manages the full photo data pipeline:
 * - Loads photos (static seed → backend swap)
 * - Derives portfolio names, filtered photos, grid pool, and list pool
 * - Provides portfolio toggle with isolate-on-first-click behavior
 */
export function usePhotos() {
  // Seed with the static list for an instant first paint, then swap in the
  // backend's published photos once they load.
  const [photoList, setPhotoList] = useState<Photo[]>(staticPhotos);
  useEffect(() => {
    let active = true;
    fetchPhotos().then((list) => {
      if (active) setPhotoList(list);
    });
    return () => {
      active = false;
    };
  }, []);

  // Track *hidden* portfolios, not selected ones: empty = everything shows,
  // and a newly-published portfolio appears by default with no re-sync.
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  // Sorted union of every photo's portfolios.
  const portfolioNames = useMemo(() => {
    const names = new Set<string>();
    for (const p of photoList) for (const name of photoPortfolios(p)) names.add(name);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [photoList]);

  // A photo shows if at least one of its portfolios is not hidden.
  const filteredPhotos = useMemo(
    () => photoList.filter((p) => photoPortfolios(p).some((name) => !hidden.has(name))),
    [photoList, hidden],
  );

  const imagePool = useMemo(() => buildImagePool(filteredPhotos), [filteredPhotos]);

  const listPool = useMemo<PortfolioWork[]>(() =>
    filteredPhotos.map((photo, i) => ({
      ...photo,
      alt: photo.alt ?? photo.title,
      span: "",
      id: `list-${photo.title}-${i}`,
    })),
    [filteredPhotos],
  );

  // If all portfolios are active (hidden is empty), clicking one isolates it.
  // Otherwise, toggle the clicked portfolio in/out of the hidden set.
  const togglePortfolio = (name: string) =>
    setHidden((prev) => {
      if (prev.size === 0) {
        const next = new Set(portfolioNames);
        next.delete(name);
        return next;
      }
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      if (next.size === portfolioNames.length) {
        return new Set();
      }
      return next;
    });

  return {
    portfolioNames,
    hidden,
    imagePool,
    listPool,
    togglePortfolio,
  };
}
