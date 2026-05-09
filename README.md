# Tech Pulse

KI-kuratiertes Tech-News-Magazin als installierbare PWA. Eine neue Edition pro
Tag, Archiv aller bisherigen Editionen, Web-Push-Benachrichtigungen.

## Stack

- **Frontend**: Vanilla JS + statisches HTML/CSS, kein Build-Step. Service
  Worker für Offline + Push.
- **Backend**: [Supabase](https://supabase.com/) (Postgres + RLS + REST). Keine
  eigene Server-App.
- **Daten-Pipeline**: GitHub Actions. Eine Cloud-Routine schreibt `data/next-edition.json`,
  ein Workflow validiert + pusht in die DB + sendet Web-Push.
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
                                      │ 3. Web-Push an Subs      │
                                      │ 4. recent-articles.json  │
                                      └──────────┬───────────────┘
                                                 │
                                                 ▼
                                      ┌──────────────────────────┐
                                      │ Supabase                 │
                                      │  · editions              │
                                      │  · articles              │
                                      │  · videos                │
                                      │  · push_subscriptions    │
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
   richtet alle Tabellen, RLS-Policies und die Push-RPCs ein.
3. Aus dem Project-Dashboard merken:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` API Key → `SUPABASE_ANON_KEY`
   - `service_role` API Key → GitHub-Secret `SUPABASE_SERVICE_ROLE_KEY` (nie ins Repo!)

### 2. VAPID-Keys für Web-Push

```bash
python3 -m pip install pywebpush
python3 -c "from py_vapid import Vapid; v = Vapid(); v.generate_keys(); print('public:', v.public_key.public_bytes_raw().hex()); print('private:', v.private_key.private_bytes_raw().hex())"
```

Praktischer: `npx web-push generate-vapid-keys` (gibt Base64URL-codierte Keys
direkt zurück). Public-Key landet in `env.js`, Private-Key als GitHub-Secret
`VAPID_PRIVATE_KEY`.

### 3. `env.js` ausfüllen

```js
window.ENV = {
  SUPABASE_URL: "https://xxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGc...",
  VAPID_PUBLIC_KEY: "BPM7..."
};
```

`env.js` enthält ausschließlich öffentliche Keys (Anon-Key + VAPID-Public).
Trotzdem: Anon-Key kann zwar in den Source committet werden, sollte aber bei
Verdacht auf Missbrauch in Supabase rotiert werden.

### 4. GitHub-Secrets

Im Repo unter Settings → Secrets and Variables → Actions:

- `SUPABASE_SERVICE_ROLE_KEY` — schreibt Editions/Articles/Videos.
- `VAPID_PRIVATE_KEY` — signiert ausgehende Push-Notifications.

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

Die Cloud-Routine schreibt `data/next-edition.json` und committed. Der Push
auf `data/next-edition.json` triggert `edition-publish.yml`:

1. **Schema-Validation** gegen `data/next-edition.schema.json` — bricht den
   Workflow ab, wenn die JSON ungültig ist (z.B. `category` außerhalb des
   Enums, weniger als 5 Artikel).
2. **DB-Write**: alte Edition wird auf `is_current = false` gesetzt, neue
   Edition + alle Artikel werden eingetragen.
3. **Web-Push**: An alle registrierten Subscriptions wird eine Notification
   gesendet. Abgelaufene Endpoints (HTTP 404/410) werden direkt gelöscht.
4. **Dedup-Fenster**: `data/recent-articles.json` wird mit den letzten 80
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
Version: `v1.2.0`.

## Push-Notifications

### Wie Subscriptions funktionieren

1. User aktiviert Push im Burger-Menü → Browser fragt Permission an.
2. `pushManager.subscribe` liefert `endpoint`, `p256dh`, `auth`.
3. `app.js` ruft die RPC `register_push(...)` mit einem **Client-Secret** auf,
   das einmalig erzeugt und in `localStorage['tp.push.secret']` abgelegt wird.
4. Beim Deaktivieren ruft die App `unregister_push(endpoint, secret)` — die
   DB löscht den Eintrag nur, wenn das Secret matched.

### Warum Client-Secret?

Anon-Clients haben keine Auth-Identität. Ohne Secret könnte jeder mit dem
Anon-Key fremde Subscription-Einträge überschreiben (Push-Hijack) oder löschen.
Das Secret stellt sicher, dass nur der Browser, der die Subscription angelegt
hat, sie auch ändern kann.

### Troubleshooting

- **Toggle reagiert nicht / kein Permission-Prompt** → Browser-Berechtigung
  prüfen (Site-Settings).
- **iPhone**: Push funktioniert nur in installierter PWA ("Zum Home-Bildschirm").
- **Subscription erscheint doppelt in DB** → User hat `localStorage` gelöscht
  oder Browser-Profile gewechselt. Alter Eintrag wird beim nächsten 410 vom
  Workflow entsorgt.
- **Notifications kommen nicht an** → Workflow-Log prüfen (Push-Fehler werden
  pro Subscription geloggt).

## Security

- **RLS** ist auf allen Tabellen aktiv. Anon kann `editions`, `articles` und
  `videos` lesen — sonst nichts.
- **`push_subscriptions`** hat keine direkten DML-Policies für anon. Mutationen
  laufen ausschließlich über `register_push` / `unregister_push`
  (`SECURITY DEFINER`-RPCs mit Client-Secret-Check).
- **Service-Role-Key** wird ausschließlich in GitHub Actions verwendet (für
  DB-Writes und Push-Cleanup) und niemals an den Client ausgeliefert.
- Frontend rendert alle externen Strings via `escHtml`/`escAttr`/`safeUrl`
  (`app.js`) — kein `innerHTML` ohne Escaping, URL-Whitelist auf `http(s):`.

## Repository-Struktur

```
.
├── index.html              # Aktuelle Edition
├── archive.html            # Archiv aller Editionen
├── env.js                  # Public-Frontend-Konfig (Anon, VAPID-Public)
├── app.js                  # Render, Daten, Nav, Push
├── sw.js                   # Service Worker (Cache + Push)
├── styles.css
├── manifest.webmanifest
├── icons/
├── data/
│   ├── next-edition.json   # Input für Workflow
│   ├── next-edition.schema.json  # Vertrag, Workflow validiert dagegen
│   └── recent-articles.json      # Dedup-Fenster (auto-generiert)
├── supabase_migration.sql  # Komplettes Schema + Policies + RPCs
└── .github/workflows/
    ├── edition-publish.yml
    └── youtube-check.yml
```
