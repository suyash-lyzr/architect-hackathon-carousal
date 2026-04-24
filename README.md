# Lyzr Agentathon — Live Wall

Auto-sliding carousel of live X/Twitter posts tagged **#LyzrAgentathon**, designed for a big-screen display at the Architect Hackathon.

Designed in the Lyzr visual system (Playfair Display + DM Sans, warm brown + rose palette, ambient orbs).

## Local development

```bash
npm install
cp .env.example .env   # then fill in TWITTER_BEARER_TOKEN
npm start
# open http://localhost:3939
```

## Deploy on Vercel

1. Import this repo into Vercel.
2. In **Project Settings → Environment Variables**, add:
   - `TWITTER_BEARER_TOKEN` — required
   - `HASHTAG` — optional, defaults to `LyzrAgentathon`
   - `REFRESH_MINUTES` — optional, defaults to `30`
3. Deploy. No build step; static files serve from root, `api/tweets.js` is a serverless function.

## How it works

- `api/tweets.js` — serverless function; queries Twitter API v2 `search/recent`, caches in-memory per instance for `REFRESH_MINUTES`.
- `index.html` / `style.css` / `app.js` — static frontend; marquee-style horizontal slide, re-polls `/api/tweets` every 60s, full re-render on change.
- `server.js` — local-only Express server mirroring the same behavior.
