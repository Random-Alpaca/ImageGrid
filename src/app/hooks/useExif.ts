import { useEffect, useRef, useState } from "react";
import exifr from "exifr";
import type { ExifInfo } from "../types";
import type { PortfolioWork } from "../types";

/** Round a number to two significant figures (used for shot values, not GPS). */
const toTwoSigFigs = (val: number): number => {
  if (typeof val !== "number" || isNaN(val)) return val;
  return Number(val.toPrecision(2));
};

/**
 * Fetches and parses EXIF metadata for the currently selected photo.
 *
 * Strategy: try client-side `exifr.parse()` first (works when CDN sends CORS
 * headers), then fall back to the `/api/exif` server-side proxy. Stale
 * requests are cancelled via AbortController.
 */
export function useExif(selected: PortfolioWork | null): ExifInfo | null {
  const [exif, setExif] = useState<ExifInfo | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setExif(null);
    if (!selected) return;

    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;

    const PICK = {
      pick: [
        "Make", "Model", "LensModel", "FocalLength", "FocalLengthIn35mmFilm",
        "FNumber", "ExposureTime", "ISO", "DateTimeOriginal", "latitude", "longitude",
      ],
      gps: true,
    };

    const parseViaApi = () =>
      fetch(`/api/exif?url=${encodeURIComponent(selected.src)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

    Promise.resolve()
      .then(() => exifr.parse(selected.src, PICK).catch(() => null))
      .then((direct) => direct ?? parseViaApi())
      .then(async (raw) => {
        if (ctrl.signal.aborted || !raw) return;

        const camera = [raw.Make, raw.Model].filter(Boolean).join(" ") || undefined;
        const lens = raw.LensModel as string | undefined;

        let date: string | undefined;
        const dto = raw.DateTimeOriginal;
        if (dto) {
          const d = dto instanceof Date ? dto : new Date(dto as string);
          if (!isNaN(d.getTime()))
            date = new Intl.DateTimeFormat("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }).format(d);
        }

        const expParts: string[] = [];
        const fl = raw.FocalLengthIn35mmFilm ?? raw.FocalLength;
        if (fl) expParts.push(`${toTwoSigFigs(fl)}mm`);
        if (raw.FNumber) expParts.push(`f/${toTwoSigFigs(raw.FNumber)}`);
        if (raw.ExposureTime) {
          if (raw.ExposureTime < 1) {
            expParts.push(`1/${toTwoSigFigs(Math.round(1 / raw.ExposureTime))}s`);
          } else {
            expParts.push(`${toTwoSigFigs(raw.ExposureTime)}s`);
          }
        }
        if (raw.ISO) expParts.push(`ISO ${toTwoSigFigs(raw.ISO)}`);
        const exposure = expParts.length ? expParts.join(" · ") : undefined;

        // Prefer the manually-set location; fall back to GPS reverse-geocode.
        let location: string | undefined = selected.location;
        if (!location && raw.latitude && raw.longitude) {
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${raw.latitude}&lon=${raw.longitude}&format=json`,
              { signal: ctrl.signal, headers: { "Accept-Language": "en" } },
            );
            const geo = await res.json();
            const a = geo.address ?? {};
            location = [a.city ?? a.town ?? a.village ?? a.county, a.country]
              .filter(Boolean)
              .join(", ");
          } catch {
            /* no GPS or blocked */
          }
        }

        if (!ctrl.signal.aborted) setExif({ camera, lens, date, exposure, location });
      })
      .catch(() => {});
  }, [selected?.src]);

  return exif;
}
