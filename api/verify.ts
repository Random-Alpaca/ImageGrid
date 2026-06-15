import type { VercelRequest, VercelResponse } from "@vercel/node";
import { checkAuth } from "./_lib";

// POST /api/verify with Authorization: Bearer <passphrase> -> { ok: true }
// Lets the admin page confirm the passphrase before showing the editor.
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const auth = checkAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
  return res.status(200).json({ ok: true });
}
