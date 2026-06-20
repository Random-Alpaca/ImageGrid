import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GOOGLE_AI_API_KEY is not configured." });

  const src = typeof req.body?.src === "string" ? req.body.src : "";
  if (!src) return res.status(400).json({ error: "src required." });

  // Fetch the image and convert to base64 for the API
  let imageData: string;
  let mimeType: string;
  try {
    const imgRes = await fetch(src);
    if (!imgRes.ok) return res.status(400).json({ error: "Could not fetch image." });
    mimeType = imgRes.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    const buf = await imgRes.arrayBuffer();
    imageData = Buffer.from(buf).toString("base64");
  } catch {
    return res.status(400).json({ error: "Failed to load image." });
  }

  try {
    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({ model: "gemma-4-31b-it" });

    const result = await model.generateContent([
      {
        inlineData: { data: imageData, mimeType },
      },
      `You are a photo caption writer for a photography portfolio. Analyze this image and respond with ONLY a JSON object (no markdown, no explanation) in this exact format:
{
  "title": "short evocative title, 1–4 words, no punctuation",
  "caption": "one or two sentences describing what is shown and the mood, written in present tense",
  "location": "City, Country (or region if city is unknown), or empty string if location cannot be determined"
}`,
    ]);

    const text = result.response.text().trim();
    // Strip any accidental markdown fences
    const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(json) as { title?: string; caption?: string; location?: string };

    return res.status(200).json({
      title: String(parsed.title ?? "").trim(),
      caption: String(parsed.caption ?? "").trim(),
      location: String(parsed.location ?? "").trim(),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Generation failed.",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
