'use strict';

const { createClient } = supabase;
const sb = createClient(window.ENV.SUPABASE_URL, window.ENV.SUPABASE_ANON_KEY);

// ── Security helpers ──────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '#';
    return u.href;
  } catch {
    return '#';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

const ZONE_LABELS = {
  core:     'KI Core',
  adjacent: 'Adjacent',
  outside:  'Kontext',
  wildcard: 'Wildcard',
};

function zoneBadge(zone) {
  if (!zone) return '';
  return `<span class="zone-badge">${escHtml(ZONE_LABELS[zone] || zone)}</span>`;
}

function readTime(min) {
  return min ? `<span class="read-time">${min} Min.</span>` : '';
}

// Returns validated http/https URL string, or '' for anything invalid/missing.
function safeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '';
  } catch { return ''; }
}

function imgTag(url, lazy) {
  const src = safeUrl(url);
  if (!src) return '';
  const loading = lazy ? 'lazy' : 'eager';
  return `<img src="${escHtml(src)}" alt="" loading="${loading}">`;
}

// ── Module renderers ──────────────────────────────────────────────────────────

function renderHero(a) {
  const url = escAttr(a.source_url);
  const img = safeUrl(a.image_url);
  return `
    <a href="${url}" target="_blank" rel="noopener noreferrer"
       class="mod-hero${img ? '' : ' no-image'}">
      ${img ? `<div class="hero-img">${imgTag(img, false)}</div><div class="hero-overlay"></div>` : ''}
      <div class="hero-content">
        ${zoneBadge(a.zone) ? `<p class="hero-zone">${escHtml(ZONE_LABELS[a.zone] || a.zone)}</p>` : ''}
        <h2 class="hero-title">${escHtml(a.title)}</h2>
        ${a.summary ? `<p class="hero-summary">${escHtml(a.summary)}</p>` : ''}
        <div class="hero-meta">
          <span class="hero-source">${escHtml(a.source_name || 'Quelle')}</span>
          ${readTime(a.read_time_min)}
        </div>
      </div>
    </a>`;
}

function renderFeature(a) {
  const url = escAttr(a.source_url);
  const img = safeUrl(a.image_url);
  return `
    <a href="${url}" target="_blank" rel="noopener noreferrer" class="mod-feature">
      ${img ? `<div class="feature-img">${imgTag(img, true)}</div>` : ''}
      <div class="feature-body">
        ${zoneBadge(a.zone)}
        <h3 class="feature-title">${escHtml(a.title)}</h3>
        ${a.summary ? `<p class="feature-summary">${escHtml(a.summary)}</p>` : ''}
        <div class="feature-meta">
          <span class="source-link">${escHtml(a.source_name || 'Quelle')} ↗</span>
          ${readTime(a.read_time_min)}
        </div>
      </div>
    </a>`;
}

function renderStandard(a, spanClass) {
  const url = escAttr(a.source_url);
  const img = safeUrl(a.image_url);
  const classes = ['mod-standard', spanClass, !img && a.zone ? `zone-accent-${a.zone}` : ''].filter(Boolean).join(' ');
  return `
    <a href="${url}" target="_blank" rel="noopener noreferrer" class="${classes}">
      ${img ? `<div class="standard-img">${imgTag(img, true)}</div>` : ''}
      <div class="standard-body">
        ${zoneBadge(a.zone)}
        <h3 class="standard-title">${escHtml(a.title)}</h3>
        ${a.summary ? `<p class="standard-summary">${escHtml(a.summary)}</p>` : ''}
        <div class="standard-meta">
          <span>${escHtml(a.source_name || 'Quelle')}</span>
          ${readTime(a.read_time_min)}
        </div>
      </div>
    </a>`;
}

function renderQuick(a) {
  const url = escAttr(a.source_url);
  return `
    <a href="${url}" target="_blank" rel="noopener noreferrer" class="mod-quick">
      <span class="quick-title">${escHtml(a.title)}</span>
      <span class="quick-meta">${escHtml(a.source_name || 'Quelle')}</span>
    </a>`;
}

function renderQuickGroup(articles) {
  return `
    <div class="quick-section">
      <p class="quick-label">Quick Pulse</p>
      <div class="quick-row">
        ${articles.map(renderQuick).join('')}
      </div>
    </div>`;
}

function renderQuote(a) {
  const url = escAttr(a.source_url);
  const text = a.quote_text || a.title;
  return `
    <div class="mod-quote">
      <span class="quote-mark">"</span>
      <blockquote class="quote-text">${escHtml(text)}</blockquote>
      ${a.quote_author ? `<p class="quote-author">— ${escHtml(a.quote_author)}</p>` : ''}
      ${url !== '#' ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="quote-link">${escHtml(a.source_name || 'Quelle')} ↗</a>` : ''}
    </div>`;
}

function renderVisual(a) {
  const url = escAttr(a.source_url);
  const img = safeUrl(a.image_url);
  return `
    <a href="${url}" target="_blank" rel="noopener noreferrer"
       class="mod-visual${img ? '' : ' no-image'}">
      ${img ? `<div class="visual-img">${imgTag(img, true)}</div><div class="visual-overlay"></div>` : ''}
      <div class="visual-content">
        ${zoneBadge(a.zone)}
        <h3 class="visual-title">${escHtml(a.title)}</h3>
        <p class="visual-meta">${escHtml(a.source_name || 'Quelle')} ↗</p>
      </div>
    </a>`;
}

// ── Grid builder ──────────────────────────────────────────────────────────────

// Groups consecutive quick articles; renders all other formats individually.
function buildGrid(articles) {
  const parts = [];
  let i = 0;
  while (i < articles.length) {
    const a = articles[i];
    if (a.format === 'quick') {
      const group = [];
      while (i < articles.length && articles[i].format === 'quick') group.push(articles[i++]);
      parts.push(renderQuickGroup(group));
    } else if (a.format === 'quote')   { parts.push(renderQuote(a));   i++; }
    else if (a.format === 'feature')   { parts.push(renderFeature(a)); i++; }
    else if (a.format === 'visual')    { parts.push(renderVisual(a));  i++; }
    else {
      const group = [];
      while (i < articles.length && articles[i].format !== 'quick' && articles[i].format !== 'quote' && articles[i].format !== 'feature' && articles[i].format !== 'visual' && articles[i].format !== 'hero') group.push(articles[i++]);
      const spanClass = group.length === 1 ? 'span-8' : group.length === 2 ? 'span-6' : 'span-4';
      group.forEach(g => parts.push(renderStandard(g, spanClass)));
    }
  }
  return `<div class="magazine-grid">${parts.join('')}</div>`;
}

// ── Index page ────────────────────────────────────────────────────────────────

async function loadCurrentEdition() {
  const container = document.getElementById('magazine');
  if (!container) return;

  const { data: editions, error: edErr } = await sb
    .from('editions')
    .select('*')
    .eq('is_current', true)
    .limit(1);

  if (edErr || !editions?.length) {
    container.innerHTML = '<p class="error">Keine aktuelle Edition gefunden.</p>';
    return;
  }

  const edition = editions[0];

  const { data: articles, error: artErr } = await sb
    .from('articles')
    .select('*')
    .eq('edition_id', edition.id)
    .order('position', { ascending: true });

  if (artErr) {
    container.innerHTML = '<p class="error">Artikel konnten nicht geladen werden.</p>';
    return;
  }

  const list = articles || [];
  const hero = list.find(a => a.format === 'hero');
  const rest = list.filter(a => a.format !== 'hero');

  const videosHtml = await loadVideos();

  container.innerHTML = `
    <div class="edition-intro">
      ${edition.edition_date ? `<p class="edition-eyebrow">${formatDate(edition.edition_date)}</p>` : ''}
      ${edition.summary ? `<p class="edition-summary">${escHtml(edition.summary)}</p>` : ''}
    </div>
    ${hero ? renderHero(hero) : ''}
    ${rest.length ? buildGrid(rest) : ''}
    ${videosHtml}
  `;
}

// ── Archive page ──────────────────────────────────────────────────────────────

async function loadArchive() {
  const container = document.getElementById('archive-page');
  if (!container) return;

  const { data: editions, error: edErr } = await sb
    .from('editions')
    .select('*')
    .order('edition_date', { ascending: false });

  if (edErr || !editions) {
    container.innerHTML = '<p class="error">Archiv konnte nicht geladen werden.</p>';
    return;
  }

  if (!editions.length) {
    container.innerHTML = '<p class="loading">Noch keine Editionen vorhanden.</p>';
    return;
  }

  const ids = editions.map(e => e.id);

  // Fetch hero images and article counts in parallel
  const [{ data: heroRows }, countResults] = await Promise.all([
    ids.length
      ? sb.from('articles').select('edition_id, image_url').in('edition_id', ids).eq('format', 'hero')
      : Promise.resolve({ data: [] }),
    Promise.all(editions.map(e =>
      sb.from('articles').select('id', { count: 'exact', head: true }).eq('edition_id', e.id)
        .then(({ count }) => ({ id: e.id, count: count ?? 0 }))
    )),
  ]);

  const heroMap = Object.fromEntries((heroRows || []).map(r => [r.edition_id, r.image_url]));
  const countMap = Object.fromEntries(countResults.map(r => [r.id, r.count]));

  const items = editions.map(ed => {
    const img = safeUrl(heroMap[ed.id]);
    const href = ed.is_current ? 'index.html' : null;
    const disabled = href ? '' : 'aria-disabled="true"';
    return `
      <a ${href ? `href="${href}"` : ''} class="archive-item" ${disabled}>
        <div class="archive-thumb">
          ${img ? `<img src="${img}" alt="" loading="lazy">` : '<div class="img-placeholder"></div>'}
        </div>
        <div class="archive-item-body">
          <p class="archive-item-title">${escHtml(ed.title)}</p>
          <div class="archive-item-meta">
            <span>${formatDate(ed.edition_date)}</span>
            <span>·</span>
            <span>${countMap[ed.id]} Artikel</span>
            ${ed.is_current ? '<span class="current-badge">Aktuell</span>' : ''}
          </div>
        </div>
        ${ed.is_current ? '<span class="archive-chevron">›</span>' : ''}
      </a>`;
  }).join('');

  container.innerHTML = `
    <div class="archive-header"><h1>Archiv</h1></div>
    <div class="archive-list">${items}</div>
  `;
}

// ── Video Pulse ───────────────────────────────────────────────────────────────

async function loadVideos() {
  const CHANNELS = [
    { id: 'UCv90NdTyTp7ZPPRvvSZaS5w', name: 'Digitale Profis' },
    { id: 'UCDx6L69jmKBJbNu5GnkCilg', name: 'Christoph Magnussen' },
  ];

  const results = await Promise.all(
    CHANNELS.map(ch =>
      sb.from('videos')
        .select('*')
        .eq('channel_id', ch.id)
        .order('published_at', { ascending: false })
        .limit(3)
    )
  );

  const sections = CHANNELS.map((ch, i) => {
    const videos = results[i].data;
    if (!videos?.length) return '';

    const cards = videos.map(v => {
      const thumb = `https://img.youtube.com/vi/${escHtml(v.video_id)}/maxresdefault.jpg`;
      const url = `https://www.youtube.com/watch?v=${escHtml(v.video_id)}`;
      return `
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="video-card">
          <div class="video-thumb">
            <img src="${thumb}" alt="" loading="lazy">
            <div class="video-play">▶</div>
          </div>
          <div class="video-body">
            <h3 class="video-title">${escHtml(v.title)}</h3>
            <p class="video-date">${formatDate(v.published_at)}</p>
          </div>
        </a>`;
    }).join('');

    return `
      <div class="video-channel-section">
        <p class="video-channel-label">${escHtml(ch.name)}</p>
        <div class="video-grid video-grid-3">${cards}</div>
      </div>`;
  }).filter(Boolean);

  if (!sections.length) return '';

  return `
    <section class="video-pulse">
      <p class="video-pulse-label">Video Pulse</p>
      ${sections.join('')}
    </section>`;
}

// ── Nav burger ────────────────────────────────────────────────────────────────

function initNav() {
  const burger = document.getElementById('burger');
  const menu = document.getElementById('nav-menu');
  if (!burger || !menu) return;

  burger.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!open));
    menu.classList.toggle('open', !open);
  });

  document.addEventListener('click', e => {
    if (!burger.contains(e.target) && !menu.contains(e.target)) {
      burger.setAttribute('aria-expanded', 'false');
      menu.classList.remove('open');
    }
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  loadCurrentEdition();
  loadArchive();
});
