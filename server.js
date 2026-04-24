import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BEARER = process.env.TWITTER_BEARER_TOKEN;
const HASHTAG = process.env.HASHTAG || "LyzrAgentathon";
const PORT = parseInt(process.env.PORT || "3939", 10);
const REFRESH_MS = parseInt(process.env.REFRESH_MINUTES || "30", 10) * 60 * 1000;
const CACHE_FILE = path.join(__dirname, "cache.json");

if (!BEARER) {
  console.error("Missing TWITTER_BEARER_TOKEN in .env");
  process.exit(1);
}

let cache = { fetchedAt: 0, tweets: [], error: null };
if (fs.existsSync(CACHE_FILE)) {
  try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); } catch {}
}

async function fetchTweets() {
  const query = encodeURIComponent(`#${HASHTAG} -is:retweet`);
  const url =
    `https://api.twitter.com/2/tweets/search/recent?query=${query}` +
    `&max_results=50` +
    `&tweet.fields=created_at,public_metrics,attachments,entities` +
    `&expansions=author_id,attachments.media_keys` +
    `&user.fields=name,username,profile_image_url,verified` +
    `&media.fields=url,preview_image_url,type,width,height`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${BEARER}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitter API ${res.status}: ${body}`);
  }

  const data = await res.json();
  const users = new Map((data.includes?.users || []).map(u => [u.id, u]));
  const media = new Map((data.includes?.media || []).map(m => [m.media_key, m]));

  const tweets = (data.data || []).map(t => {
    const user = users.get(t.author_id) || {};
    const mediaItems = (t.attachments?.media_keys || [])
      .map(k => media.get(k))
      .filter(Boolean)
      .map(m => ({
        type: m.type,
        url: m.url || m.preview_image_url,
      }));
    return {
      id: t.id,
      text: t.text,
      created_at: t.created_at,
      metrics: t.public_metrics,
      author: {
        name: user.name,
        username: user.username,
        profile_image_url: user.profile_image_url?.replace("_normal", "_400x400"),
        verified: !!user.verified,
      },
      media: mediaItems,
      url: `https://x.com/${user.username}/status/${t.id}`,
    };
  });

  // newest first
  tweets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return tweets;
}

async function refresh() {
  try {
    console.log(`[${new Date().toISOString()}] Fetching tweets for #${HASHTAG}...`);
    const tweets = await fetchTweets();
    cache = { fetchedAt: Date.now(), tweets, error: null };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log(`  got ${tweets.length} tweets`);
  } catch (e) {
    console.error("  fetch failed:", e.message);
    cache.error = e.message;
    cache.fetchedAt = Date.now();
  }
}

const app = express();
app.use(express.static(__dirname, {
  index: "index.html",
  extensions: ["html"],
  setHeaders: (res, p) => {
    // avoid serving server-side files
    if (p.endsWith(".env") || p.endsWith("server.js")) res.status(404).end();
  },
}));

app.get("/api/tweets", (_req, res) => {
  res.json({
    hashtag: HASHTAG,
    fetchedAt: cache.fetchedAt,
    nextRefreshAt: cache.fetchedAt + REFRESH_MS,
    error: cache.error,
    tweets: cache.tweets,
  });
});

app.listen(PORT, () => {
  console.log(`Carousel running at http://localhost:${PORT}`);
  console.log(`Tracking #${HASHTAG}, refreshing every ${REFRESH_MS / 60000} min`);
});

await refresh();
setInterval(refresh, REFRESH_MS);
