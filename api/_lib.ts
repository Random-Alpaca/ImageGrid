import { Redis } from "@upstash/redis";

export type Photo = { src: string; title: string; caption: string; alt?: string; location?: string; portfolios?: string[] };

export const PHOTOS_KEY = "portfolio:photos";

// The Upstash/KV connection is injected by Vercel as env vars when you add the
// Upstash Redis integration. We accept either the KV_* or UPSTASH_* names.
export function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Non-secret report of which connection env vars are present, for diagnostics.
export function envStatus() {
  return {
    KV_REST_API_URL: Boolean(process.env.KV_REST_API_URL),
    KV_REST_API_TOKEN: Boolean(process.env.KV_REST_API_TOKEN),
    UPSTASH_REDIS_REST_URL: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    UPSTASH_REDIS_REST_TOKEN: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    ADMIN_PASSWORD: Boolean(process.env.ADMIN_PASSWORD),
  };
}

function bearer(req: { headers: Record<string, unknown> }): string {
  const raw = (req.headers.authorization || req.headers.Authorization || "") as string;
  return raw.startsWith("Bearer ") ? raw.slice(7) : "";
}

// Length-independent constant-time comparison so we don't leak the passphrase
// through response timing.
function safeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkAuth(req: { headers: Record<string, unknown> }): {
  ok: boolean;
  status: number;
  error?: string;
} {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return { ok: false, status: 500, error: "ADMIN_PASSWORD is not set on the server." };
  }
  const token = bearer(req);
  if (!token || !safeEqual(token, password)) {
    return { ok: false, status: 401, error: "Invalid passphrase." };
  }
  return { ok: true, status: 200 };
}

export function isValidList(value: unknown): value is Photo[] {
  return (
    Array.isArray(value) &&
    value.every(
      (p) =>
        p &&
        typeof p === "object" &&
        typeof (p as Photo).src === "string" &&
        typeof (p as Photo).title === "string" &&
        typeof (p as Photo).caption === "string",
    )
  );
}
