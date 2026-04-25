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

function safeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '';
  } catch { return ''; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

const CATEGORY_LABELS = {
  core:      'KI Core',
  adjacent:  'Tech',
  outside:   'Kontext',
  wildcard:  'Wildcard',
};

function categoryLabel(zone) {
  return CATEGORY_LABELS[zone] || zone || '';
}

function badge(zone) {
  const label = categoryLabel(zone);
  if (!label) return '';
  return `<span class="badge">${escHtml(label)}</span>`;
}

function badgeOnDark(zone) {
  const label = categoryLabel(zone);
  if (!label) return '';
  return `<span class="badge-on-dark">${escHtml(label)}</span>`;
}

function sourcePill(url, name, onDark = false) {
  const href = escAttr(url);
  const cls = onDark ? 'source-pill on-dark' : 'source-pill';
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${cls}" onclick="event.stopPropagation()">
    <span>${escHtml(name || 'Quelle')}</span><span class="arrow">↗</span>
  </a>`;
}

// Span-version for use inside card <a> wrappers (avoids invalid nested <a>)
function sourcePillSpan(name, onDark = false) {
  const cls = onDark ? 'source-pill on-dark' : 'source-pill';
  return `<span class="${cls}"><span>${escHtml(name || 'Quelle')}</span><span class="arrow">↗</span></span>`;
}

function imgTag(url, lazy = true) {
  const src = safeUrl(url);
  if (!src) return '';
  return `<img src="${escHtml(src)}" alt="" loading="${lazy ? 'lazy' : 'eager'}">`;
}

// ── Image placeholder SVG ─────────────────────────────────────────────────────

function imgPlaceholder(extraClass = '') {
  return `<div class="card-default-img-placeholder ${extraClass}">
    <svg viewBox="0 0 100 56" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="0" x2="100" y2="56" stroke="#D2D2D7" stroke-width="0.4" vector-effect="non-scaling-stroke"/>
      <line x1="100" y1="0" x2="0" y2="56" stroke="#D2D2D7" stroke-width="0.4" vector-effect="non-scaling-stroke"/>
    </svg>
  </div>`;
}

// ── Hero card ─────────────────────────────────────────────────────────────────

function renderHero(a) {
  const img = safeUrl(a.image_url);
  const href = escAttr(a.source_url);
  const bgLayer = img
    ? `<div class="card-img-bg">${imgTag(img, false)}</div><div class="img-overlay-hero"></div>`
    : `<div class="card-img-placeholder"></div><div class="img-overlay-hero"></div>`;
  return `
    <a href="${href}" target="_blank" rel="noopener noreferrer" class="card-hero-link">
      ${bgLayer}
      <div class="hero-body">
        ${badgeOnDark(a.zone)}
        <h2 class="hero-title">${escHtml(a.title)}</h2>
        ${a.summary ? `<p class="hero-summary">${escHtml(a.summary)}</p>` : ''}
        <div class="hero-source">${sourcePillSpan(a.source_name, true)}</div>
      </div>
    </a>`;
}

// ── Default card (white background) ──────────────────────────────────────────

function renderDefaultCard(a) {
  const img = safeUrl(a.image_url);
  const href = escAttr(a.source_url);
  const imgBlock = img
    ? `<div class="card-img-container">
         <div class="card-default-img">${imgTag(img)}</div>
         <div class="badge-img-overlay">${badgeOnDark(a.zone)}</div>
       </div>`
    : `<div class="card-img-container">
         ${imgPlaceholder()}
         <div class="badge-img-overlay">${badge(a.zone)}</div>
       </div>`;
  return `
    <a href="${href}" target="_blank" rel="noopener noreferrer" class="card-default-link">
      ${imgBlock}
      <div class="card-body">
        <h3 class="card-title">${escHtml(a.title)}</h3>
        ${a.summary ? `<p class="card-summary">${escHtml(a.summary)}</p>` : ''}
        <div class="card-footer">${sourcePillSpan(a.source_name)}</div>
      </div>
    </a>`;
}

// ── Image-bg card (dark overlay) ─────────────────────────────────────────────

function renderImageBgCard(a) {
  const img = safeUrl(a.image_url);
  const href = escAttr(a.source_url);
  const bgLayer = img
    ? `<div class="card-img-bg">${imgTag(img)}</div><div class="img-overlay-card"></div>`
    : `<div class="card-img-placeholder"></div><div class="img-overlay-card"></div>`;
  return `
    <a href="${href}" target="_blank" rel="noopener noreferrer" class="card-imagebg-link">
      ${bgLayer}
      <div class="card-imagebg-body">
        <div style="margin-bottom:10px;">${badgeOnDark(a.zone)}</div>
        <h3 class="card-imagebg-title">${escHtml(a.title)}</h3>
        ${a.summary ? `<p class="card-imagebg-summary">${escHtml(a.summary)}</p>` : ''}
        <div style="padding-top:14px;">${sourcePillSpan(a.source_name, true)}</div>
      </div>
    </a>`;
}

// ── Compact card (text-only, quick format) ────────────────────────────────────

function renderCompact(a) {
  const url = escAttr(a.source_url);
  return `
    <a href="${url}" target="_blank" rel="noopener noreferrer"
       style="text-decoration:none;color:inherit;display:block;">
      <div class="card-compact">
        ${badge(a.zone)}
        <h3 class="card-compact-title">${escHtml(a.title)}</h3>
        ${a.summary ? `<p class="card-compact-summary">${escHtml(a.summary)}</p>` : ''}
        <div class="card-compact-footer">${sourcePill(a.source_url, a.source_name)}</div>
      </div>
    </a>`;
}

// ── Quote module ──────────────────────────────────────────────────────────────

function renderQuote(a) {
  const url = escAttr(a.source_url);
  const text = a.quote_text || a.title;
  return `
    <div class="grid-span-full" style="padding:48px 32px;background:var(--badge-bg);border-radius:var(--radius);text-align:center;">
      <span style="font-size:72px;line-height:0.6;color:var(--accent);font-family:Georgia,serif;margin-bottom:28px;display:block;">"</span>
      <blockquote style="font-size:clamp(20px,2.8vw,28px);font-weight:500;letter-spacing:-0.02em;line-height:1.4;color:var(--text);max-width:720px;margin:0 auto 20px;">${escHtml(text)}</blockquote>
      ${a.quote_author ? `<p style="font-size:14px;color:var(--text2);margin-bottom:16px;">— ${escHtml(a.quote_author)}</p>` : ''}
      ${url !== '#' ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="source-pill">${escHtml(a.source_name || 'Quelle')} ↗</a>` : ''}
    </div>`;
}

// ── Grid builder ──────────────────────────────────────────────────────────────

function buildGrid(articles) {
  const gridItems = [];
  const compactItems = [];
  let imgBgCounter = 0;

  articles.forEach((a, idx) => {
    if (a.format === 'quick') {
      compactItems.push(renderCompact(a));
      return;
    }
    if (a.format === 'quote') {
      gridItems.push(renderQuote(a));
      return;
    }
    const hasImg = safeUrl(a.image_url);
    const useImageBg = hasImg && (a.format === 'feature' || a.format === 'visual' || imgBgCounter % 2 === 0);
    if (hasImg && (a.format === 'feature' || a.format === 'visual')) {
      gridItems.push(renderImageBgCard(a));
    } else if (hasImg && imgBgCounter % 2 === 0) {
      gridItems.push(renderImageBgCard(a));
      imgBgCounter++;
    } else {
      gridItems.push(renderDefaultCard(a));
      if (hasImg) imgBgCounter++;
    }
  });

  const grid = gridItems.length
    ? `<div class="cards-grid">${gridItems.join('')}</div>`
    : '';

  const compact = compactItems.length
    ? `<div class="compact-section">${compactItems.join('')}</div>`
    : '';

  return grid + compact;
}

// ── Masonry layout ────────────────────────────────────────────────────────────

let _masonryRaf = null;

function applyMasonry() {
  const grid = document.querySelector('.cards-grid');
  if (!grid) return;
  const items = [...grid.children];
  if (!items.length) return;

  if (window.innerWidth < 700) {
    grid.style.position = '';
    grid.style.height = '';
    items.forEach(item => {
      item.style.position = '';
      item.style.width = '';
      item.style.left = '';
      item.style.top = '';
    });
    return;
  }

  const cols = window.innerWidth >= 1024 ? 3 : 2;
  const gap = 20;
  grid.style.position = 'relative';
  const totalWidth = grid.offsetWidth;
  const colWidth = (totalWidth - gap * (cols - 1)) / cols;
  const colHeights = new Array(cols).fill(0);

  items.forEach(item => {
    if (item.classList.contains('grid-span-full')) {
      const top = Math.max(...colHeights);
      item.style.position = 'absolute';
      item.style.width = totalWidth + 'px';
      item.style.left = '0';
      item.style.top = top + 'px';
      colHeights.fill(top + item.offsetHeight + gap);
    } else {
      const col = colHeights.indexOf(Math.min(...colHeights));
      item.style.position = 'absolute';
      item.style.width = colWidth + 'px';
      item.style.left = col * (colWidth + gap) + 'px';
      item.style.top = colHeights[col] + 'px';
      colHeights[col] += item.offsetHeight + gap;
    }
  });

  grid.style.height = Math.max(...colHeights) - gap + 'px';
}

function scheduleMasonry() {
  cancelAnimationFrame(_masonryRaf);
  _masonryRaf = requestAnimationFrame(applyMasonry);
}

// ── Video section ─────────────────────────────────────────────────────────────

function buildVideoSection(videos) {
  if (!videos.length) return '';

  const cards = videos.map(v => {
    const thumb = `https://img.youtube.com/vi/${escHtml(v.video_id)}/maxresdefault.jpg`;
    const url = `https://www.youtube.com/watch?v=${escHtml(v.video_id)}`;
    return `
      <a href="${url}" target="_blank" rel="noopener noreferrer" class="video-item">
        <div class="video-thumb">
          <img src="${thumb}" alt="" loading="lazy">
          <div class="video-play-btn">
            <div class="video-play-circle">
              <svg width="16" height="18" viewBox="0 0 16 18" fill="#fff" aria-hidden="true">
                <path d="M0 1.5C0 .67.91.18 1.6.62l12.8 7.5a1 1 0 010 1.76L1.6 17.38C.9 17.82 0 17.33 0 16.5v-15z"/>
              </svg>
            </div>
          </div>
          ${v.duration ? `<span class="video-duration">${escHtml(v.duration)}</span>` : ''}
        </div>
        <h3 class="video-item-title">${escHtml(v.title)}</h3>
        <div class="video-item-channel">${escHtml(v.channelName || v.channel_name || '')}</div>
      </a>`;
  }).join('');

  return `
    <section class="video-section">
      <div class="video-header">
        <h2 class="video-title-main">Video Pulse</h2>
        <div class="video-nav-btns">
          <button class="video-nav-btn" id="vid-prev" aria-label="Zurück">‹</button>
          <button class="video-nav-btn" id="vid-next" aria-label="Vor">›</button>
        </div>
      </div>
      <div class="video-scroller" id="video-scroller">
        ${cards}
      </div>
    </section>`;
}

function initVideoNav() {
  const scroller = document.getElementById('video-scroller');
  const prev = document.getElementById('vid-prev');
  const next = document.getElementById('vid-next');
  if (!scroller || !prev || !next) return;
  prev.addEventListener('click', () => scroller.scrollBy({ left: -(scroller.clientWidth * 0.8), behavior: 'smooth' }));
  next.addEventListener('click', () => scroller.scrollBy({ left: scroller.clientWidth * 0.8, behavior: 'smooth' }));
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

  // Update nav edition label
  const navEd = document.getElementById('nav-edition');
  if (navEd && edition.title) navEd.textContent = `Tech Pulse · ${edition.title}`;

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

  const videos = await loadVideos();

  const dateStr = edition.edition_date
    ? new Date(edition.edition_date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  container.innerHTML = `
    ${dateStr ? `<p class="masthead">${escHtml(dateStr)}</p>` : ''}
    ${edition.summary ? `<div class="edition-intro"><p>${escHtml(edition.summary)}</p></div>` : ''}
    ${hero ? renderHero(hero) : ''}
    ${rest.length ? buildGrid(rest) : ''}
    ${buildVideoSection(videos)}
  `;

  initVideoNav();

  requestAnimationFrame(applyMasonry);
  const imgs = container.querySelectorAll('img');
  let pending = imgs.length || 1;
  function onSettled() { if (--pending <= 0) applyMasonry(); }
  if (!imgs.length) { onSettled(); }
  else imgs.forEach(img => {
    if (img.complete) onSettled();
    else {
      img.addEventListener('load', onSettled, { once: true });
      img.addEventListener('error', onSettled, { once: true });
    }
  });
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

  const countResults = await Promise.all(
    editions.map(e =>
      sb.from('articles').select('id', { count: 'exact', head: true }).eq('edition_id', e.id)
        .then(({ count }) => ({ id: e.id, count: count ?? 0 }))
    )
  );

  const countMap = Object.fromEntries(countResults.map(r => [r.id, r.count]));

  const items = editions.map(ed => {
    const href = ed.is_current ? 'index.html' : null;
    const dateStr = formatDate(ed.edition_date);
    const count = countMap[ed.id];

    return `
      <li>
        ${href
          ? `<a href="${href}" class="archive-item">`
          : `<div class="archive-item" style="opacity:0.45;">`
        }
          <div>
            <div class="archive-item-title">
              ${escHtml(ed.title)}
              ${ed.is_current ? `<span class="archive-current-badge">Aktuell</span>` : ''}
            </div>
            <div class="archive-item-meta-sm hide-wide">${dateStr} · ${count} Artikel</div>
          </div>
          <div class="archive-item-date show-wide">${dateStr}</div>
          <div class="archive-item-count show-wide">${count} Artikel</div>
        ${href ? `</a>` : `</div>`}
      </li>`;
  }).join('');

  container.innerHTML = `
    <h1 class="archive-heading">Archiv</h1>
    <ul class="archive-list">${items}</ul>
  `;
}

// ── Video loader ──────────────────────────────────────────────────────────────

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

  const channelVideos = results.map((r, i) =>
    (r.data || []).map(v => ({ ...v, channelName: CHANNELS[i].name }))
  );

  const maxLen = Math.max(0, ...channelVideos.map(v => v.length));
  const interleaved = [];
  for (let i = 0; i < maxLen; i++) {
    channelVideos.forEach(videos => { if (videos[i]) interleaved.push(videos[i]); });
  }

  return interleaved;
}

// ── Nav ───────────────────────────────────────────────────────────────────────

function initNav() {
  const burger = document.getElementById('burger');
  const overlay = document.getElementById('nav-overlay');
  const closeBtn = document.getElementById('nav-close');
  if (!burger || !overlay) return;

  function openMenu() {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  burger.addEventListener('click', openMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);

  overlay.addEventListener('click', e => {
    if (!e.target.closest('#nav-panel')) closeMenu();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMenu();
  });

  window.addEventListener('resize', scheduleMasonry);
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  loadCurrentEdition();
  loadArchive();
});
