import type { VercelRequest, VercelResponse } from "@vercel/node";
import { checkAuth, envStatus, getRedis, isValidList, PHOTOS_KEY, type Photo } from "./_lib";

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// GET  /api/photos  -> public, returns { photos: Photo[] }
// PUT  /api/photos  -> requires Authorization: Bearer <passphrase>, body { photos }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const redis = getRedis();
    if (!redis) {
      return res.status(500).json({
        error: "Storage is not configured (missing Upstash/KV env vars).",
        env: envStatus(),
      });
    }

    if (req.method === "GET") {
      const photos = (await redis.get<Photo[]>(PHOTOS_KEY)) ?? [];
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ photos });
    }

    if (req.method === "PUT" || req.method === "POST") {
      const auth = checkAuth(req);
      if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

      const body = (typeof req.body === "string" ? safeParse(req.body) : req.body) as
        | { photos?: unknown }
        | null;
      if (!body || !isValidList(body.photos)) {
        return res.status(400).json({ error: "Body must be { photos: Photo[] }." });
      }

      // Store only known fields so a malformed payload can't inject extra data.
      const clean: Photo[] = body.photos.map((p) => ({
        src: String(p.src),
        title: String(p.title),
        caption: String(p.caption ?? ""),
        ...(p.alt ? { alt: String(p.alt) } : {}),
      }));

      await redis.set(PHOTOS_KEY, clean);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, count: clean.length });
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    // Surface the real cause instead of crashing the function (which Vercel
    // reports as the opaque FUNCTION_INVOCATION_FAILED).
    return res.status(500).json({
      error: "Storage request failed.",
      detail: err instanceof Error ? err.message : String(err),
      env: envStatus(),
    });
  }
}
