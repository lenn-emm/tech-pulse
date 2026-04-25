# Claude Code Prompt-Bibliothek

Fertige Prompts für alle wiederkehrenden Aufgaben. Einfach kopieren und in Claude Code einfügen.

---

## Prompt 1 — App-Grundgerüst bauen (einmalig)

```
Bitte baue die Web-App "Tech Pulse" — eine KI-kuratierte News-App im Apple-Design-Stil.

TECH STACK
- Statisches HTML/CSS/JS, kein Framework, kein Build-Step
- Supabase als Datenbank (Zugangsdaten stehen in der .env-Datei)
- Hosting via Vercel (tech-pulse-virid.vercel.app)

DESIGN
- Apple-Stil: minimalistisch, viel Weißraum
- Font: -apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif
- Farben: Hintergrund #FFFFFF · Text #1C1C1E · Akzent #0071E3 · Grau #6E6E73
- Karten: border-radius 12px, box-shadow 0 2px 8px rgba(0,0,0,0.08)
- Mobile-first, responsive (375px / 768px / 1280px)

SUPABASE-SCHEMA (bereits in Supabase angelegt)
Tabelle editions: id, title, edition_date, is_current (bool), summary, created_at
Tabelle articles: id, edition_id (FK), title, summary, source_url, source_name, category, position, created_at

SEITEN & FEATURES
- index.html: zeigt Edition mit is_current = true. Titel + Datum oben, darunter Artikel-Karten (Headline, Summary, Quelle mit Link, Kategorie-Badge)
- archive.html: alle Editionen sortiert nach Datum, mit Titel, Datum, Artikelanzahl
- Burger-Menü: "Aktuelle Edition" (index.html) und "Archiv" (archive.html)

SUPABASE-VERBINDUNG
Binde Supabase über den offiziellen JS-Client via CDN ein.
SUPABASE_URL und SUPABASE_ANON_KEY als window.ENV-Objekt in index.html und archive.html einbinden.
Den SUPABASE_SERVICE_ROLE_KEY niemals ins Frontend einbauen.

DATEIEN
- index.html
- archive.html
- styles.css
- app.js

Fang direkt an.
```

---

## Prompt 2a — Tägliche Edition (Claude Cloud Routine) v2

Dieser Prompt läuft als Routine in Claude Cloud (täglich morgens). Er recherchiert,
baut `data/next-edition.json` und schreibt sie direkt über die GitHub Contents API
nach main. Der GitHub-Action-Workflow `edition-publish.yml` triggert automatisch und
schreibt die Edition nach Supabase (alte Editionen: `is_current=false` — **nie löschen**).

JSON-Schema: `data/next-edition.schema.json` im Repo.

```
Du bist der Redakteur von "Tech Pulse" — einer täglichen, KI-kuratierten Tech-News-Edition
im Magazin-Stil. Erstelle die heutige Edition.

══════════════════════════════════════════════════
SCHRITT 1 — DATUM
══════════════════════════════════════════════════
Aktuelles Datum Europe/Berlin → edition_date (YYYY-MM-DD).
Edition-Titel: "Tech Pulse — <Wochentag>, DD. Monat YYYY" auf Deutsch.

══════════════════════════════════════════════════
SCHRITT 2 — DEDUPLIZIERUNG (zuerst, bevor du recherchierst)
══════════════════════════════════════════════════
Rufe per Python urllib die letzten 80 Artikel aus Supabase ab:

  import urllib.request, json
  url = "https://rjmyjuejdhcnijerwwwe.supabase.co/rest/v1/articles?select=title,source_url&order=created_at.desc&limit=80"
  req = urllib.request.Request(url, headers={
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqbXlqdWVqZGhjbmlqZXJ3d3dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjg4NDMsImV4cCI6MjA5MjAwNDg0M30.21k5mfWbccw8wI4wbilQdt0Vp6qA2-3Ki-pOGkmDHJw",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqbXlqdWVqZGhjbmlqZXJ3d3dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjg4NDMsImV4cCI6MjA5MjAwNDg0M30.21k5mfWbccw8wI4wbilQdt0Vp6qA2-3Ki-pOGkmDHJw"
  })
  known = json.loads(urllib.request.urlopen(req, timeout=10).read())
  known_urls   = {a["source_url"] for a in known}
  known_titles = {a["title"].lower()[:40] for a in known}

Falls der Request fehlschlägt (Timeout, Netzwerk): mit leerem known-Set weitermachen,
kurzen Hinweis im Summary vermerken ("Dedup nicht möglich").

Prüfe auch: Existiert für das heutige Datum bereits eine Edition?
  url2 = "https://rjmyjuejdhcnijerwwwe.supabase.co/rest/v1/editions?edition_date=eq.YYYY-MM-DD&select=id"
  → Falls Ergebnis nicht leer: Abbruch. Nichts pushen.

══════════════════════════════════════════════════
SCHRITT 3 — RECHERCHE
══════════════════════════════════════════════════
Suche per WebSearch (NICHT WebFetch, nicht curl) nach den wichtigsten KI- und Tech-News
der letzten 24 Stunden. Nutze diese Suchstrategien:

Core (KI-Labs):
  "Anthropic news today" / "OpenAI announcement today" / "Google DeepMind news today"
  "Hugging Face release today" / "AI model release April 2026"

Adjacent (Tech-Medien):
  "The Verge AI news today" / "TechCrunch AI today" / "Ars Technica AI today"
  "MIT Technology Review AI this week"

Outside (Forschung):
  "arxiv AI paper today" / "Nature AI research this week"
  "Stratechery latest" / "Import AI newsletter latest"

Wildcard (Überraschung):
  "Hacker News top AI story today" / "404 Media tech story today"
  "Simon Willison blog latest"

Pro Quelle: 1–2 Suchen reichen. Keine Aggregatoren (keine Google News Snippet-Seiten),
direkt zur Primärquelle navigieren.

Filtere: Nur Meldungen der letzten 24 Stunden. Verwerfe alles, dessen source_url oder
Titel (erste 40 Zeichen) in known_urls / known_titles ist.

══════════════════════════════════════════════════
SCHRITT 4 — KURATIEREN & TEXTEN
══════════════════════════════════════════════════
ARTIKELMIX (Pflicht):
- 1× hero     (zone core/adjacent, Aufmacher des Tages)
- 4–5× feature oder visual  (Mischung aller Zonen)
- 2–3× quick  (knapp, 1 Satz Headline + 1–2 Satz Summary)
- optional 1× quote  (markantes Zitat einer Person aus einem der Artikel)

ZONEN-VERTEILUNG (Richtwert):
  core 40–50 % · adjacent 25–35 % · outside 15–20 % · wildcard 5–10 %

QUALITÄTSKRITERIEN:
  Aufnehmen: Was jemand im Innovation-Management wissen sollte.
  Weglassen:  Reine Funding-Meldungen, Promo, Gerüchte, Aggregatoren, Doppelmeldungen.

PRO ARTIKEL:
  title:        max. 10 Wörter, kein Clickbait
  summary:      2–3 Sätze. Satz 1: Was. Satz 2: Warum relevant. Satz 3 (opt.): Einordnung.
  source_url:   direkter Link zur Primärquelle
  source_name:  Name der Quelle (z.B. "The Verge")
  category:     model_release | company_news | research | product | regulation
  format:       hero | feature | visual | standard | quick | quote
  zone:         core | adjacent | outside | wildcard
  read_time_min: 1–10
  position:     Reihenfolge nach Relevanz (1 = oben)
  (bei format=quote: zusätzlich quote_text + quote_author)

Kein image_url — das Frontend nutzt automatische Zonen-Farbverläufe.

Falls nach Dedup weniger als 5 brauchbare Artikel übrig: Abbruch, nichts pushen.

══════════════════════════════════════════════════
SCHRITT 5 — JSON BAUEN & VALIDIEREN
══════════════════════════════════════════════════
Baue das JSON exakt nach diesem Schema (siehe auch data/next-edition.schema.json im Repo):

{
  "edition": {
    "title": "Tech Pulse — Montag, 28. April 2026",
    "edition_date": "2026-04-28",
    "summary": "1–2 Sätze, was diese Edition ausmacht"
  },
  "articles": [
    {
      "title": "...", "summary": "...", "source_url": "...", "source_name": "...",
      "category": "...", "format": "...", "zone": "...",
      "read_time_min": 3, "position": 1
    }
  ]
}

Validiere mit Python json.loads() vor dem Push. Kein manuelles JSON-Zusammenbauen
mit String-Konkatenation — immer json.dumps() verwenden.

══════════════════════════════════════════════════
SCHRITT 6 — AUF GITHUB PUSHEN (GitHub Contents API via Python)
══════════════════════════════════════════════════
WICHTIG: Kein git, kein curl, kein subprocess. Ausschließlich Python urllib.

  import urllib.request, json, base64

  GITHUB_TOKEN = "DEIN_PAT_HIER"
  REPO    = "lenn-emm/tech-pulse"
  PATH    = "data/next-edition.json"
  API_URL = f"https://api.github.com/repos/{REPO}/contents/{PATH}"
  HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "User-Agent": "TechPulse-Routine/2"
  }

  # 1) SHA holen falls Datei existiert
  sha = None
  try:
    r = urllib.request.Request(API_URL, headers=HEADERS)
    existing = json.loads(urllib.request.urlopen(r, timeout=15).read())
    sha = existing.get("sha")
  except urllib.error.HTTPError as e:
    if e.code != 404:
      raise

  # 2) Datei anlegen oder updaten
  content_b64 = base64.b64encode(
    json.dumps(edition_payload, ensure_ascii=False, indent=2).encode("utf-8")
  ).decode("ascii")

  body = {"message": f"edition: {edition_date}", "content": content_b64, "branch": "main"}
  if sha:
    body["sha"] = sha

  req = urllib.request.Request(
    API_URL, data=json.dumps(body).encode(), headers=HEADERS, method="PUT"
  )
  resp = json.loads(urllib.request.urlopen(req, timeout=20).read())
  print("✓ Gepusht:", resp["content"]["html_url"])

Der Push auf main triggert automatisch edition-publish.yml, der:
- die bisherige Edition auf is_current=false setzt (NIEMALS löschen)
- die neue Edition + Artikel in Supabase schreibt
- Editionen bleiben dauerhaft im Archiv erreichbar
```

---

## Prompt 2 — Neue Edition erstellen (wöchentlich, manuell — veraltet)

```
Erstelle eine neue Tech Pulse Edition für die Woche vom [DATUM] bis [DATUM].

RECHERCHE-SCOPE
Suche aktiv in diesen Bereichen — nicht nur KI-Labs:
- Neue KI-Modelle & Releases: OpenAI, Anthropic (inkl. Claude Code, Routines, API-Updates), Google DeepMind, Meta, Mistral, xAI und kleinere Labs
- Produkte & Features: Bedeutende KI-Features in bestehenden Produkten (Microsoft, Apple, Adobe etc.)
- Forschung: Paper oder Studien mit konkreten, überraschenden Ergebnissen — keine reinen Fortschrittsberichte
- Unternehmen & Markt: Zahlen, Quartalsergebnisse, Deals — aber nur wenn sie etwas über den Stand der KI-Adoption aussagen (z.B. Chip-Nachfrage, Adoptionsstudien)
- Regulierung & Gesellschaft: EU AI Act Umsetzung, Regulierungsvorhaben mit konkretem Datum oder Wirkung

QUALITÄTSKRITERIEN
Lass weg: Gerüchte ohne offizielle Quelle, reine Fundraising-Meldungen ohne Produktrelevanz, Promotioninhalte, Meldungen die in der Vorwoche schon erschienen sind.
Aufnehmen: Jede News, bei der jemand im Innovation Management eines großen Unternehmens sagen würde: "Das sollte ich wissen."

Pro Edition: 6–8 Artikel. Pro Artikel:
- Titel (max. 10 Wörter, keine Clickbait-Formulierungen)
- Zusammenfassung (2–3 Sätze): Satz 1 — was ist passiert. Satz 2 — warum das konkret relevant ist oder was sich dadurch ändert. Satz 3 optional — Kontext oder Einordnung.
- Quelle + Link zum Originalartikel (Primärquelle bevorzugen, keine Aggregatoren)
- Kategorie: model_release | company_news | research | product | regulation

Danach in Supabase:
1. Neue Edition einfügen (is_current = true)
2. Alle anderen Editionen: is_current = false
3. Artikel einfügen (korrekte edition_id, position 1–n nach Relevanz)

SUPABASE_SERVICE_ROLE_KEY aus .env verwenden.
```

---

## Prompt 3 — Bug / Feature

```
[Beschreibe Problem oder Feature]

Kontext: Statisches HTML/CSS/JS, Supabase als DB, kein Framework, Apple-Design.
Nur die Dateien ändern, die sich wirklich ändern.
```

---

## Prompt 4 — Design-Review

```
Prüfe index.html und styles.css auf Apple-Design-Konformität:
- Ausreichend Weißraum?
- Konsistente Typographie?
- Mobile-Ansicht sauber?

Konkrete Verbesserungen direkt umsetzen.
```

---

## Prompt 5 — Daten prüfen

```
Prüfe die Supabase-Datenbank:
- Wie viele Editionen gibt es?
- Welche ist aktuell (is_current = true)?
- Wie viele Artikel hat die aktuelle Edition?

Anon Key reicht (nur Lesezugriff).
```

---

## Deployment

Nach jeder Änderung:
```bash
git add .
git commit -m "kurze Beschreibung"
git push origin main
# Vercel deployed automatisch → tech-pulse-virid.vercel.app
```
