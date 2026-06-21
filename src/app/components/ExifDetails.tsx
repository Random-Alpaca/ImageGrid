import type { ExifInfo } from "../types";

interface ExifDetailsProps {
  exif: ExifInfo;
}

/** EXIF metadata table shown in the modal aside panel. */
export function ExifDetails({ exif }: ExifDetailsProps) {
  if (!exif.camera && !exif.exposure && !exif.date && !exif.location) return null;

  return (
    <dl className="mt-7 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-white/10 pt-6 text-xs">
      {exif.camera && (
        <>
          <dt className="pt-px text-white/40">Camera</dt>
          <dd className="text-white/70">{exif.camera}</dd>
        </>
      )}
      {exif.lens && (
        <>
          <dt className="pt-px text-white/40">Lens</dt>
          <dd className="text-white/70">{exif.lens}</dd>
        </>
      )}
      {exif.exposure && (
        <>
          <dt className="pt-px text-white/40">Exposure Details</dt>
          <dd className="text-white/70">{exif.exposure}</dd>
        </>
      )}
      {exif.date && (
        <>
          <dt className="pt-px text-white/40">Date</dt>
          <dd className="text-white/70">{exif.date}</dd>
        </>
      )}
      {exif.location && (
        <>
          <dt className="pt-px text-white/40">Location</dt>
          <dd className="text-white/70">{exif.location}</dd>
        </>
      )}
    </dl>
  );
}
