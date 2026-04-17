const { createClient } = supabase;
const sb = createClient(window.ENV.SUPABASE_URL, window.ENV.SUPABASE_ANON_KEY);

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

const BADGE_LABELS = {
  model_release: 'Modell',
  company_news:  'Unternehmen',
  research:      'Forschung',
  product:       'Produkt',
  regulation:    'Regulierung',
};

function badge(category) {
  const label = BADGE_LABELS[category] || category;
  return `<span class="badge badge-${category}">${label}</span>`;
}

function setContent(el, html) {
  if (el) el.innerHTML = html;
}

// ── Index page ───────────────────────────────────────────────────────────────

async function loadCurrentEdition() {
  const container = document.getElementById('edition-container');
  if (!container) return;

  setContent(container, '<p class="loading">Wird geladen…</p>');

  const { data: editions, error: edErr } = await sb
    .from('editions')
    .select('*')
    .eq('is_current', true)
    .limit(1);

  if (edErr || !editions?.length) {
    setContent(container, '<p class="error">Edition konnte nicht geladen werden.</p>');
    return;
  }

  const edition = editions[0];

  const { data: articles, error: artErr } = await sb
    .from('articles')
    .select('*')
    .eq('edition_id', edition.id)
    .order('position', { ascending: true });

  if (artErr) {
    setContent(container, '<p class="error">Artikel konnten nicht geladen werden.</p>');
    return;
  }

  const articleCards = (articles || []).map(a => `
    <article class="card">
      <div class="card-top">
        <h2 class="card-title">${escHtml(a.title)}</h2>
        ${badge(a.category)}
      </div>
      <p class="card-summary">${escHtml(a.summary)}</p>
      <a class="card-source" href="${escAttr(a.source_url)}" target="_blank" rel="noopener noreferrer">
        ${escHtml(a.source_name || 'Quelle')}
      </a>
    </article>
  `).join('');

  setContent(container, `
    <header class="edition-header">
      <h1 class="edition-title">${escHtml(edition.title)}</h1>
      <p class="edition-date">${formatDate(edition.edition_date)}</p>
      ${edition.summary ? `<p class="edition-summary">${escHtml(edition.summary)}</p>` : ''}
    </header>
    <section class="articles-grid">
      ${articleCards || '<p class="empty">Noch keine Artikel in dieser Edition.</p>'}
    </section>
  `);
}

// ── Archive page ─────────────────────────────────────────────────────────────

async function loadArchive() {
  const container = document.getElementById('archive-container');
  if (!container) return;

  setContent(container, '<p class="loading">Wird geladen…</p>');

  const { data: editions, error } = await sb
    .from('editions')
    .select('id, title, edition_date, is_current')
    .order('edition_date', { ascending: false });

  if (error || !editions?.length) {
    setContent(container, editions?.length === 0
      ? '<p class="empty">Noch keine Editionen vorhanden.</p>'
      : '<p class="error">Archiv konnte nicht geladen werden.</p>');
    return;
  }

  // Fetch article counts per edition
  const counts = await Promise.all(editions.map(async e => {
    const { count } = await sb
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('edition_id', e.id);
    return { id: e.id, count: count ?? 0 };
  }));

  const countMap = Object.fromEntries(counts.map(c => [c.id, c.count]));

  const items = editions.map(e => `
    <a class="edition-card" href="${e.is_current ? 'index.html' : '#'}" ${e.is_current ? '' : 'aria-disabled="true" tabindex="-1"'}>
      <div class="edition-card-info">
        <div class="edition-card-title">${escHtml(e.title)}</div>
        <div class="edition-card-meta">${formatDate(e.edition_date)} · ${countMap[e.id]} Artikel</div>
      </div>
      <div class="edition-card-right">
        ${e.is_current ? '<span class="current-badge">Aktuell</span>' : ''}
        <span class="chevron">›</span>
      </div>
    </a>
  `).join('');

  setContent(container, `<div class="editions-list">${items}</div>`);
}

// ── XSS helpers ──────────────────────────────────────────────────────────────

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

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadCurrentEdition();
  loadArchive();
});
