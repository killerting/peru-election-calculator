// Server-side cache: shared across all users for 5 minutes
const CACHE_TTL = 5 * 60 * 1000;
let cachedResult = null;
let cacheTimestamp = 0;

// Simple in-memory rate limiter: max 5 requests per IP per minute
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 5;
  if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, []);
  const timestamps = rateLimitMap.get(ip).filter(t => now - t < windowMs);
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return timestamps.length > maxRequests;
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  return origin.endsWith(".vercel.app") || origin.endsWith("killerting.github.io");
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "*";

  if (!isAllowedOrigin(req.headers.origin)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Return cached result if still fresh
  if (cachedResult && Date.now() - cacheTimestamp < CACHE_TTL) {
    return res.status(200).json({ ...cachedResult, cached: true });
  }

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Demasiadas solicitudes. Espera un minuto." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  try {
    const prompt = `Search the web for the latest official ONPE results for Peru's 2026 presidential second round (segunda vuelta) between Keiko Fujimori and Roberto Sánchez. Return ONLY a JSON object with these exact fields, no other text:
{
  "fujimori_votes": <integer>,
  "sanchez_votes": <integer>,
  "pct_counted": <float>,
  "last_updated": "<HH:MM time string>"
}
Use the most recent figures available from onpe.gob.pe or major Peruvian news sources. If the election is over and 100% counted, use those final numbers.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON in response: " + text.slice(0, 100));
    const parsed = JSON.parse(clean.slice(start, end + 1));
    cachedResult = parsed;
    cacheTimestamp = Date.now();
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
