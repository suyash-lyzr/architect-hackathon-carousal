// Vercel serverless function
// Fetches #LyzrAgentathon posts from Twitter API v2.
// In-memory cached per function instance; refreshed after REFRESH_MINUTES.

const HASHTAG = process.env.HASHTAG || "LyzrAgentathon";
const REFRESH_MINUTES = parseInt(process.env.REFRESH_MINUTES || "30", 10);
const REFRESH_MS = REFRESH_MINUTES * 60 * 1000;

let cache = { fetchedAt: 0, tweets: [], error: null };
let inflight = null;

async function fetchTweets() {
  const bearer = process.env.TWITTER_BEARER_TOKEN;
  if (!bearer) throw new Error("Missing TWITTER_BEARER_TOKEN env var");

  // Start of today in UTC (IST = UTC+5:30, so midnight IST = 18:30 previous UTC day;
  // using UTC midnight is close enough and keeps it simple)
  const today = new Date();
  const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const startTime = startOfDay.toISOString();

  const query = encodeURIComponent(`#${HASHTAG} -is:retweet`);
  const url =
    `https://api.twitter.com/2/tweets/search/recent?query=${query}` +
    `&max_results=50` +
    `&start_time=${startTime}` +
    `&sort_order=recency` +
    `&tweet.fields=created_at,public_metrics,attachments,entities` +
    `&expansions=author_id,attachments.media_keys` +
    `&user.fields=name,username,profile_image_url,verified` +
    `&media.fields=url,preview_image_url,type,width,height`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${bearer}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitter API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const users = new Map((data.includes?.users || []).map(u => [u.id, u]));
  const media = new Map((data.includes?.media || []).map(m => [m.media_key, m]));

  const tweets = (data.data || []).map(t => {
    const user = users.get(t.author_id) || {};
    const mediaItems = (t.attachments?.media_keys || [])
      .map(k => media.get(k))
      .filter(Boolean)
      .map(m => ({ type: m.type, url: m.url || m.preview_image_url }));
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
  tweets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return tweets;
}

async function refreshIfStale() {
  const age = Date.now() - cache.fetchedAt;
  if (cache.tweets.length && age < REFRESH_MS) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const tweets = await fetchTweets();
      cache = { fetchedAt: Date.now(), tweets, error: null };
    } catch (e) {
      cache = { ...cache, fetchedAt: Date.now(), error: e.message };
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export default async function handler(_req, res) {
  await refreshIfStale();
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
  res.status(200).json({
    hashtag: HASHTAG,
    fetchedAt: cache.fetchedAt,
    nextRefreshAt: cache.fetchedAt + REFRESH_MS,
    error: cache.error,
    tweets: cache.tweets,
  });
}
