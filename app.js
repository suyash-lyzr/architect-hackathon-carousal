const track = document.getElementById("track");
const statusEl = document.getElementById("status");
const hashtagEl = document.getElementById("hashtag");

let tweets = [];
let hashtag = "LyzrAgentathon";

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

function linkify(text) {
  let t = escapeHtml(text);
  // Strip t.co links inside text (media images appear separately)
  t = t.replace(/(https?:\/\/t\.co\/\S+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  t = t.replace(/(^|\s)(#[\w]+)/g, '$1<span class="hashtag">$2</span>');
  t = t.replace(/(^|\s)(@[\w]+)/g, '$1<a href="https://x.com/$2" target="_blank" rel="noopener">$2</a>');
  return t;
}

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function formatCount(n) {
  if (!n && n !== 0) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

const ICONS = {
  like: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  retweet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
};

const X_LOGO = '<svg class="x-logo" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';

function renderCard(t) {
  const a = t.author || {};
  const avatar = a.profile_image_url
    ? `<img class="avatar" src="${escapeHtml(a.profile_image_url)}" alt="" onerror="this.outerHTML='<div class=avatar-fallback>${(a.name||'?')[0].toUpperCase()}</div>'" />`
    : `<div class="avatar-fallback">${escapeHtml((a.name || "?")[0].toUpperCase())}</div>`;

  const mediaHtml = (t.media || []).slice(0, 1).map(m => {
    if (!m.url) return "";
    if (m.type === "video" || m.type === "animated_gif") {
      return `<div class="tweet-media"><img src="${escapeHtml(m.url)}" alt="" /></div>`;
    }
    return `<div class="tweet-media"><img src="${escapeHtml(m.url)}" alt="" /></div>`;
  }).join("");

  const m = t.metrics || {};
  const verified = a.verified ? '<span class="verified">✓</span>' : '';

  return `
    <article class="card">
      <div class="card-head">
        ${avatar}
        <div class="author">
          <div class="author-name">${escapeHtml(a.name || "Unknown")}${verified}</div>
          <div class="author-handle">@${escapeHtml(a.username || "unknown")}</div>
        </div>
        ${X_LOGO}
      </div>
      <div class="tweet-text">${linkify(t.text || "")}</div>
      ${mediaHtml}
      <div class="card-foot">
        <div class="stat">${ICONS.reply}<span>${formatCount(m.reply_count)}</span></div>
        <div class="stat">${ICONS.retweet}<span>${formatCount(m.retweet_count)}</span></div>
        <div class="stat">${ICONS.like}<span>${formatCount(m.like_count)}</span></div>
        <div class="stat">${ICONS.view}<span>${formatCount(m.impression_count)}</span></div>
        <div class="date">${timeAgo(t.created_at)}</div>
      </div>
    </article>
  `;
}

function renderEmpty(msg) {
  track.classList.add("paused");
  track.style.animation = "none";
  track.innerHTML = `
    <div class="empty">
      <div>
        <div class="eyebrow">Live Wall · Stand by</div>
        <div class="big">No posts <em>yet</em></div>
        <div class="sub">${escapeHtml(msg)}</div>
      </div>
    </div>
  `;
}

function render() {
  if (!tweets.length) {
    renderEmpty(`Waiting for someone to post with #${hashtag}…`);
    return;
  }

  track.classList.remove("paused");
  track.style.animation = "";

  // Duplicate list so the marquee loops seamlessly (animation translates -50%)
  const html = tweets.map(renderCard).join("") + tweets.map(renderCard).join("");
  track.innerHTML = html;

  // Scale animation duration to number of cards for consistent slow speed
  const secondsPerCard = 12; // larger = slower
  track.style.animationDuration = `${Math.max(60, tweets.length * secondsPerCard)}s`;
}

function updateStatus(fetchedAt, error) {
  if (error) {
    statusEl.textContent = `error · ${error.slice(0, 60)}`;
    return;
  }
  if (!fetchedAt) {
    statusEl.textContent = "loading…";
    return;
  }
  const mins = Math.floor((Date.now() - fetchedAt) / 60000);
  statusEl.textContent = mins === 0 ? "updated just now" : `updated ${mins}m ago`;
}

async function fetchData() {
  try {
    const res = await fetch("/api/tweets", { cache: "no-store" });
    const data = await res.json();
    hashtag = data.hashtag || hashtag;
    hashtagEl.textContent = `#${hashtag}`;

    const ids = new Set(tweets.map(t => t.id));
    const incoming = data.tweets || [];
    const newIds = new Set(incoming.map(t => t.id));
    const changed =
      incoming.length !== tweets.length ||
      incoming.some(t => !ids.has(t.id)) ||
      tweets.some(t => !newIds.has(t.id));

    tweets = incoming;
    if (changed) render();
    updateStatus(data.fetchedAt, data.error);
  } catch (e) {
    updateStatus(0, e.message);
  }
}

fetchData();
// Poll the local cache every minute (server refreshes from Twitter every 30 min)
setInterval(fetchData, 60 * 1000);
// Update "updated Xm ago" and countdown every 15s
setInterval(() => updateStatus(Date.now() - (Date.now() % 60000), null), 15 * 1000);
