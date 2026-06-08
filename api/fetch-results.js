import { Redis } from "@upstash/redis";

const CACHE_KEY = "election_results";

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

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      return res.status(200).json({ ...cached, cached: true });
    }

    return res.status(503).json({ error: "No data available yet. The background updater hasn't run." });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
