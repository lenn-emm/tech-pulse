# Tech Pulse

KI-kuratiertes Tech-News-Magazin als installierbare PWA. Eine neue Edition pro
Tag, Archiv aller bisherigen Editionen.

## Stack

- **Frontend**: Vanilla JS + statisches HTML/CSS, kein Build-Step. Service
  Worker für Offline.
- **Backend**: [Supabase](https://supabase.com/) (Postgres + RLS + REST). Keine
  eigene Server-App.
- **Daten-Pipeline**: GitHub Actions. Eine Cloud-Routine schreibt `data/next-edition.json`,
  ein Workflow validiert + schreibt in die DB.
- **Hosting**: Statische Files (z.B. GitHub Pages, Netlify, beliebiges CDN).

## Architektur

```
┌─────────────────────┐    push      ┌──────────────────────────┐
│ Cloud-Routine       │ ───────────▶ │ data/next-edition.json   │
│ (kuratiert Edition) │              └──────────┬───────────────┘
└─────────────────────┘                         │ trigger
                                                ▼
                                      ┌──────────────────────────┐
                                      │ edition-publish.yml      │
                                      │ 1. Schema-Validation     │
                                      │ 2. INSERT editions/articles│
                                      │ 3. recent-articles.json  │
                                      └──────────┬───────────────┘
                                                 │
                                                 ▼
                                      ┌──────────────────────────┐
                                      │ Supabase                 │
                                      │  · editions              │
                                      │  · articles              │
                                      │  · videos                │
                                      └──────────┬───────────────┘
                                                 │ REST (anon)
                                                 ▼
                                      ┌──────────────────────────┐
                                      │ PWA Frontend             │
                                      │  index.html / archive.html│
                                      │  app.js + sw.js          │
                                      └──────────────────────────┘

YouTube-RSS  ──▶  youtube-check.yml (cron)  ──▶  videos table  ──▶  Frontend
```

## Setup

### 1. Supabase-Projekt anlegen

1. Neues Projekt unter https://supabase.com/.
2. Im SQL-Editor `supabase_migration.sql` komplett ausführen. Die Migration
   richtet alle Tabellen und RLS-Policies ein.
3. Aus dem Project-Dashboard merken:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` API Key → `SUPABASE_ANON_KEY`
   - `service_role` API Key → GitHub-Secret `SUPABASE_SERVICE_ROLE_KEY` (nie ins Repo!)

### 2. `env.js` ausfüllen

```js
window.ENV = {
  SUPABASE_URL: "https://xxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGc..."
};
```

`env.js` enthält ausschließlich öffentliche Keys (Anon-Key).
Trotzdem: Anon-Key kann zwar in den Source committet werden, sollte aber bei
Verdacht auf Missbrauch in Supabase rotiert werden.

### 3. GitHub-Secrets

Im Repo unter Settings → Secrets and Variables → Actions:

- `SUPABASE_SERVICE_ROLE_KEY` — schreibt Editions/Articles/Videos.

## Local Development

Kein Build-Step — einfach einen statischen Server starten:

```bash
python3 -m http.server 8080
# oder
npx serve .
```

`http://localhost:8080` öffnet die App. Service-Worker funktioniert nur über
HTTP(S), nicht beim Öffnen via `file://`.

## Daten-Pipeline

### Neue Edition publizieren

Die Cloud-Routine schreibt `data/next-edition.json` und committed. Der Commit
auf `data/next-edition.json` triggert `edition-publish.yml`:

1. **Schema-Validation** gegen `data/next-edition.schema.json` — bricht den
   Workflow ab, wenn die JSON ungültig ist (z.B. `category` außerhalb des
   Enums, weniger als 5 Artikel).
2. **DB-Write**: alte Edition wird auf `is_current = false` gesetzt, neue
   Edition + alle Artikel werden eingetragen.
3. **Dedup-Fenster**: `data/recent-articles.json` wird mit den letzten 80
   Artikeln regeneriert und committed — die Cloud-Routine nutzt diese Liste,
   um Duplikate zu vermeiden.

### YouTube-Pulse

`youtube-check.yml` läuft als Cron (5:00 / 17:00 UTC), liest YouTube-RSS für
die konfigurierten Kanäle und schreibt neue Videos in die `videos`-Tabelle.

## Deployment

GitHub Pages, Netlify, Cloudflare Pages oder beliebiger statischer Host.
Wichtig: Service-Worker erfordert HTTPS (außer auf `localhost`).

**Cache-Bumping**: Bei jedem App-Update (Frontend-Changes) `CACHE_VERSION` in
`sw.js` erhöhen — sonst liefert der Service Worker alten Code aus. Aktuelle
Version: `v1.3.0`.

## Security

- **RLS** ist auf allen Tabellen aktiv. Anon kann `editions`, `articles` und
  `videos` lesen — sonst nichts.
- **Service-Role-Key** wird ausschließlich in GitHub Actions verwendet (für
  DB-Writes) und niemals an den Client ausgeliefert.
- Frontend rendert alle externen Strings via `escHtml`/`escAttr`/`safeUrl`
  (`app.js`) — kein `innerHTML` ohne Escaping, URL-Whitelist auf `http(s):`.

## Repository-Struktur

```
.
├── index.html              # Aktuelle Edition
├── archive.html            # Archiv aller Editionen
├── env.js                  # Public-Frontend-Konfig (Anon)
├── app.js                  # Render, Daten, Nav
├── sw.js                   # Service Worker (Cache)
├── styles.css
├── manifest.webmanifest
├── icons/
├── data/
│   ├── next-edition.json   # Input für Workflow
│   ├── next-edition.schema.json  # Vertrag, Workflow validiert dagegen
│   └── recent-articles.json      # Dedup-Fenster (auto-generiert)
├── supabase_migration.sql  # Komplettes Schema + Policies
└── .github/workflows/
    ├── edition-publish.yml
    └── youtube-check.yml
```
