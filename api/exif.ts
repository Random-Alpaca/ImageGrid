import type { VercelRequest, VercelResponse } from "@vercel/node";
import exifr from "exifr";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = typeof req.query.url === "string" ? req.query.url : "";
  if (!url) return res.status(400).json({ error: "url required" });

  try { new URL(url); } catch {
    return res.status(400).json({ error: "invalid url" });
  }

  try {
    const data = await exifr.parse(url, {
      pick: ["Make", "Model", "LensModel", "FocalLength", "FocalLengthIn35mmFilm", "FNumber", "ExposureTime", "ISO", "DateTimeOriginal", "latitude", "longitude"],
      gps: true,
    });
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.status(200).json(data ?? null);
  } catch {
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.status(200).json(null);
  }
}
