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

const ARROW_SVG = `<svg class="arrow" width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8L8 3M3.5 3H8v4.5"/></svg>`;

function sourcePill(url, name, onDark = false) {
  const href = escAttr(url);
  if (href === '#') return '';
  const cls = onDark ? 'source-pill on-dark' : 'source-pill';
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${cls}"><span>${escHtml(name || 'Quelle')}</span>${ARROW_SVG}</a>`;
}

// ── Hero card ─────────────────────────────────────────────────────────────────

function renderHero(a) {
  const href = escAttr(a.source_url);
  const titleHtml = href !== '#'
    ? `<h2 class="hero-title"><a href="${href}" target="_blank" rel="noopener noreferrer">${escHtml(a.title)}</a></h2>`
    : `<h2 class="hero-title">${escHtml(a.title)}</h2>`;
  const slug = zoneSlug(a.zone);
  return `
    <article class="card-hero-link">
      <div class="card-fallback-bg" data-zone="${slug}"></div>
      <div class="img-overlay-hero"></div>
      <div class="hero-body">
        ${badgeOnDark(a.zone)}
        ${titleHtml}
        ${a.summary ? `<p class="hero-summary">${escHtml(a.summary)}</p>` : ''}
        <div class="hero-source">${sourcePill(a.source_url, a.source_name, true)}</div>
      </div>
    </article>`;
}

// ── Color-bg card (dark overlay) ─────────────────────────────────────────────

function zoneSlug(zone) {
  return (zone || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'default';
}

function renderImageBgCard(a) {
  const slug = zoneSlug(a.zone);
  return `
    <article class="card-imagebg-link">
      <div class="card-fallback-bg" data-zone="${slug}"></div>
      <div class="img-overlay-card"></div>
      <div class="card-imagebg-body">
        <div style="margin-bottom:10px;">${badgeOnDark(a.zone)}</div>
        <h3 class="card-imagebg-title">${escHtml(a.title)}</h3>
        ${a.summary ? `<p class="card-imagebg-summary">${escHtml(a.summary)}</p>` : ''}
        <div style="padding-top:14px;">${sourcePill(a.source_url, a.source_name, true)}</div>
      </div>
    </article>`;
}

// ── Compact card (text-only, quick format) ────────────────────────────────────

function renderCompact(a, idx = 0) {
  const slug = zoneSlug(a.zone);
  const variant = idx % 3;
  return `
    <article class="card-compact" data-zone="${slug}" data-variant="${variant}">
      <div class="card-compact-meta">
        ${badge(a.zone)}
        ${sourcePill(a.source_url, a.source_name)}
      </div>
      <h3 class="card-compact-title">${escHtml(a.title)}</h3>
      ${a.summary ? `<p class="card-compact-summary">${escHtml(a.summary)}</p>` : ''}
    </article>`;
}

// ── Quote module ──────────────────────────────────────────────────────────────

function renderQuote(a) {
  const text = a.quote_text || a.title;
  return `
    <div class="grid-span-full quote-block">
      <span class="quote-mark">"</span>
      <blockquote class="quote-text">${escHtml(text)}</blockquote>
      ${a.quote_author ? `<p class="quote-author">— ${escHtml(a.quote_author)}</p>` : ''}
      ${sourcePill(a.source_url, a.source_name)}
    </div>`;
}

// ── Grid builder ──────────────────────────────────────────────────────────────

function buildGrid(articles) {
  const gridItems = [];
  const compactItems = [];

  articles.forEach(a => {
    if (a.format === 'quick') {
      compactItems.push(renderCompact(a, compactItems.length));
      return;
    }
    if (a.format === 'quote') {
      gridItems.push(renderQuote(a));
      return;
    }
    gridItems.push(renderImageBgCard(a));
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
    const id = escHtml(v.video_id);
    const thumbHi = `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
    const thumbLo = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    const url = `https://www.youtube.com/watch?v=${id}`;
    return `
      <a href="${url}" target="_blank" rel="noopener noreferrer" class="video-item">
        <div class="video-thumb">
          <img src="${thumbHi}" alt="" loading="lazy"
               onerror="if(this.dataset.fb!=='1'){this.dataset.fb='1';this.src='${thumbLo}';}else{this.style.display='none';}">
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
        <div class="video-controls">
          <div class="video-progress" id="video-progress" role="presentation">
            <div class="video-progress-thumb" id="video-progress-thumb"></div>
          </div>
          <div class="video-nav-btns">
            <button class="video-nav-btn" id="vid-prev" aria-label="Zurück">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9 2L4 7l5 5"/>
              </svg>
            </button>
            <button class="video-nav-btn" id="vid-next" aria-label="Vor">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M5 2l5 5-5 5"/>
              </svg>
            </button>
          </div>
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
  const track = document.getElementById('video-progress');
  const thumb = document.getElementById('video-progress-thumb');
  if (!scroller || !prev || !next) return;

  function step(dir) {
    scroller.scrollBy({ left: dir * scroller.clientWidth * 0.8, behavior: 'smooth' });
  }
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));

  function updateProgress() {
    if (!track || !thumb) return;
    const max = scroller.scrollWidth - scroller.clientWidth;
    if (max <= 0) {
      track.style.display = 'none';
      prev.disabled = true;
      next.disabled = true;
      return;
    }
    track.style.display = '';
    const visibleRatio = scroller.clientWidth / scroller.scrollWidth;
    const scrollRatio = scroller.scrollLeft / max;
    const trackW = track.clientWidth;
    const thumbW = Math.max(24, trackW * visibleRatio);
    const thumbX = (trackW - thumbW) * scrollRatio;
    thumb.style.width = thumbW + 'px';
    thumb.style.transform = `translateX(${thumbX}px)`;
    prev.disabled = scroller.scrollLeft <= 1;
    next.disabled = scroller.scrollLeft >= max - 1;
  }

  scroller.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();
  setTimeout(updateProgress, 300);
}

// ── Index page ────────────────────────────────────────────────────────────────

function renderSkeleton() {
  return `
    <div class="skeleton-wrap" aria-hidden="true">
      <div class="skeleton skeleton-line" style="width:160px;height:14px;"></div>
      <div class="skeleton skeleton-line" style="width:90%;height:22px;margin-top:18px;"></div>
      <div class="skeleton skeleton-line" style="width:75%;height:22px;margin-top:8px;"></div>
      <div class="skeleton skeleton-hero" style="margin-top:40px;"></div>
      <div class="skeleton-grid" style="margin-top:24px;">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </div>
    </div>`;
}

async function loadCurrentEdition() {
  const container = document.getElementById('magazine');
  if (!container) return;

  container.innerHTML = renderSkeleton();

  const params = new URLSearchParams(window.location.search);
  const editionId = params.get('edition');

  let edQ = sb.from('editions').select('*');
  edQ = editionId ? edQ.eq('id', editionId) : edQ.eq('is_current', true);
  const { data: editions, error: edErr } = await edQ.limit(1);

  if (edErr || !editions?.length) {
    container.innerHTML = '<p class="error">Keine Edition gefunden.</p>';
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

  const videos = editionId ? [] : await loadVideos();

  const dateStr = edition.edition_date
    ? new Date(edition.edition_date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const archiveBack = editionId
    ? `<a class="archive-back" href="archive.html"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2L4 7l5 5"/></svg> Archiv</a>`
    : '';

  container.innerHTML = `
    ${archiveBack}
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

  container.innerHTML = `
    <div class="skeleton-wrap" aria-hidden="true">
      <div class="skeleton skeleton-line" style="width:140px;height:34px;"></div>
      <div class="skeleton skeleton-line" style="width:100%;height:18px;margin-top:36px;"></div>
      <div class="skeleton skeleton-line" style="width:100%;height:18px;margin-top:24px;"></div>
      <div class="skeleton skeleton-line" style="width:100%;height:18px;margin-top:24px;"></div>
    </div>`;

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
    const href = ed.is_current ? 'index.html' : `index.html?edition=${encodeURIComponent(ed.id)}`;
    const dateStr = formatDate(ed.edition_date);
    const count = countMap[ed.id];

    return `
      <li>
        <a href="${href}" class="archive-item">
          <div>
            <div class="archive-item-title">
              ${escHtml(ed.title)}
              ${ed.is_current ? `<span class="archive-current-badge">Aktuell</span>` : ''}
            </div>
            <div class="archive-item-meta-sm hide-wide">${dateStr} · ${count} Artikel</div>
          </div>
          <div class="archive-item-date show-wide">${dateStr}</div>
          <div class="archive-item-count show-wide">${count} Artikel</div>
        </a>
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

let _savedScrollY = 0;

function lockBodyScroll() {
  _savedScrollY = window.scrollY;
  const b = document.body;
  b.style.position = 'fixed';
  b.style.top = `-${_savedScrollY}px`;
  b.style.left = '0';
  b.style.right = '0';
  b.style.width = '100%';
}

function unlockBodyScroll() {
  const b = document.body;
  b.style.position = '';
  b.style.top = '';
  b.style.left = '';
  b.style.right = '';
  b.style.width = '';
  window.scrollTo(0, _savedScrollY);
}

function initNav() {
  const burger = document.getElementById('burger');
  const overlay = document.getElementById('nav-overlay');
  if (!burger || !overlay) return;
  const panel = overlay.querySelector('#nav-panel');

  function focusables() {
    return panel ? [...panel.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])')] : [];
  }

  function setOpen(open) {
    const wasOpen = overlay.classList.contains('open');
    if (open === wasOpen) return;
    overlay.classList.toggle('open', open);
    burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Menü schliessen' : 'Menü öffnen');
    if (open) {
      lockBodyScroll();
      const f = focusables();
      if (f.length) f[0].focus();
    } else {
      unlockBodyScroll();
      burger.focus();
    }
  }

  burger.addEventListener('click', () => {
    setOpen(!overlay.classList.contains('open'));
  });

  overlay.addEventListener('click', e => {
    if (!e.target.closest('#nav-panel') && !e.target.closest('#burger')) setOpen(false);
  });

  document.addEventListener('keydown', e => {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key !== 'Tab') return;
    const f = focusables();
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  });

  window.addEventListener('resize', scheduleMasonry);
}

// ── PWA / Service Worker ──────────────────────────────────────────────────────

function initPWA() {
  if (!('serviceWorker' in navigator)) return;
  const register = () => {
    navigator.serviceWorker
      .register('sw.js', { scope: './' })
      .then((reg) => initPush(reg))
      .catch((err) => console.warn('[PWA] Service Worker konnte nicht registriert werden:', err));
  };
  // Im Hintergrund registrieren — aber nur warten, wenn `load` noch nicht
  // gefeuert hat. Sonst direkt registrieren (Race Condition vermeiden).
  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}

// ── Push Notifications ────────────────────────────────────────────────────────

function pushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function isStandalonePWA() {
  // iOS / Android / Desktop-PWA
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function getCurrentSubscription(reg) {
  try { return await reg.pushManager.getSubscription(); } catch { return null; }
}

async function savePushSubscription(sub) {
  const json = sub.toJSON();
  const payload = {
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent,
  };
  const { error } = await sb
    .from('push_subscriptions')
    .upsert(payload, { onConflict: 'endpoint' });
  if (error) throw error;
}

async function deletePushSubscription(endpoint) {
  // Nicht kritisch wenn das fehlschlägt: Workflow räumt 410-er ohnehin später auf.
  await sb.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

function renderPushUI(state) {
  const panel = document.getElementById('nav-panel');
  if (!panel) return;
  let host = panel.querySelector('.push-settings');
  if (!host) {
    host = document.createElement('div');
    host.className = 'push-settings';
    panel.appendChild(host);
  }

  // States: 'unsupported-ios-needs-install' | 'unsupported' | 'denied'
  //       | 'subscribed' | 'unsubscribed' | 'busy'
  const isOn = state.status === 'subscribed';
  const busy = state.status === 'busy';
  const disabled = busy || state.status === 'unsupported' || state.status === 'unsupported-ios-needs-install' || state.status === 'denied';

  let hint = '';
  if (state.status === 'denied') {
    hint = 'In den Browser-Einstellungen für diese Seite aktivieren.';
  } else if (state.status === 'unsupported-ios-needs-install') {
    hint = 'Auf iPhone: Teilen → „Zum Home-Bildschirm“, dann hier aktivieren.';
  } else if (state.status === 'unsupported') {
    hint = 'Dein Browser unterstützt keine Push-Benachrichtigungen.';
  }

  host.innerHTML = `
    <div class="push-row">
      <div class="push-label">
        <span class="push-title">Benachrichtigungen</span>
        <span class="push-sub">Neue Editions & Videos</span>
      </div>
      <button
        type="button"
        class="push-toggle ${isOn ? 'on' : ''}"
        role="switch"
        aria-checked="${isOn ? 'true' : 'false'}"
        aria-label="Benachrichtigungen ${isOn ? 'deaktivieren' : 'aktivieren'}"
        ${disabled ? 'disabled' : ''}
      >
        <span class="push-toggle-thumb"></span>
      </button>
    </div>
    ${hint ? `<p class="push-hint">${escHtml(hint)}</p>` : ''}
  `;

  if (!disabled) {
    host.querySelector('.push-toggle').addEventListener('click', () => {
      togglePush(isOn);
    });
  }
}

let pushRegistration = null;

async function togglePush(currentlyOn) {
  if (!pushRegistration) return;
  renderPushUI({ status: 'busy' });
  try {
    if (currentlyOn) {
      const sub = await getCurrentSubscription(pushRegistration);
      if (sub) {
        await deletePushSubscription(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
      }
      renderPushUI({ status: 'unsubscribed' });
    } else {
      // Permission anfragen (User-Geste)
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        renderPushUI({ status: perm === 'denied' ? 'denied' : 'unsubscribed' });
        return;
      }
      const sub = await pushRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(window.ENV.VAPID_PUBLIC_KEY),
      });
      await savePushSubscription(sub);
      renderPushUI({ status: 'subscribed' });
    }
  } catch (err) {
    console.warn('[Push] Toggle fehlgeschlagen:', err);
    // Fallback: aktuellen Zustand neu laden
    await refreshPushUI();
  }
}

async function refreshPushUI() {
  if (!pushRegistration) return;
  if (!pushSupported()) {
    if (isIOS() && !isStandalonePWA()) {
      renderPushUI({ status: 'unsupported-ios-needs-install' });
    } else {
      renderPushUI({ status: 'unsupported' });
    }
    return;
  }
  if (Notification.permission === 'denied') {
    renderPushUI({ status: 'denied' });
    return;
  }
  const sub = await getCurrentSubscription(pushRegistration);
  renderPushUI({ status: sub ? 'subscribed' : 'unsubscribed' });
}

async function initPush(reg) {
  pushRegistration = reg;

  // SW kann uns sagen, wenn Subscription abgelaufen ist
  navigator.serviceWorker.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'pushsubscriptionchange') {
      try {
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(window.ENV.VAPID_PUBLIC_KEY),
        });
        await savePushSubscription(sub);
      } catch (e) { console.warn('[Push] Re-Subscribe fehlgeschlagen:', e); }
      refreshPushUI();
    }
  });

  if (!pushSupported()) {
    if (isIOS() && !isStandalonePWA()) {
      renderPushUI({ status: 'unsupported-ios-needs-install' });
    } else {
      renderPushUI({ status: 'unsupported' });
    }
    return;
  }

  await refreshPushUI();
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  loadCurrentEdition();
  loadArchive();
  initPWA();
});
