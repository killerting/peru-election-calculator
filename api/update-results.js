import { Redis } from "@upstash/redis";

const CACHE_KEY = "election_results";

export default async function handler(req, res) {
  // Secure the endpoint with a secret token
  const authHeader = req.headers["authorization"];
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

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
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
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

    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    await redis.set(CACHE_KEY, parsed);

    return res.status(200).json({ success: true, data: parsed });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
