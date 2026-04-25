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

## Prompt 2a — Tägliche Edition (Claude Cloud Routine) v3

**v3-Änderungen gegenüber v2:**
- Dedup läuft nicht mehr über Supabase (anon-Key wird dort 403'd), sondern über
  `data/recent-articles.json` im Repo selbst. Die Routine liest und schreibt diese
  Datei direkt über die GitHub Contents API.
- Idempotenz-Check: Routine liest zuerst `data/next-edition.json` und bricht ab,
  wenn `edition_date` bereits = heute.
- PAT muss EINMALIG am Anfang des Prompts gesetzt werden (`GITHUB_TOKEN = "ghp_…"`).
- Strikt nur Python urllib für Schreib-/Leseoperationen. Kein git, kein curl, kein
  MCP-Push (alle scheitern in der Cloud-Umgebung mit 403).

Dieser Prompt läuft als Routine in Claude Cloud (täglich morgens). Er recherchiert,
baut `data/next-edition.json` + aktualisiert `data/recent-articles.json` und pusht
beides direkt über die GitHub Contents API. Der Workflow `edition-publish.yml`
triggert automatisch und schreibt die Edition nach Supabase (alte Editionen:
`is_current=false` — **nie löschen**).

JSON-Schema: `data/next-edition.schema.json` im Repo.

```
Du bist der Redakteur von "Tech Pulse" — einer täglichen, KI-kuratierten Tech-News-Edition
im Magazin-Stil. Erstelle die heutige Edition vollautomatisch.

═══════════════════════════════════════════════════════════════
KONFIGURATION (einmalig setzen, dann nie wieder anfassen)
═══════════════════════════════════════════════════════════════
GITHUB_TOKEN = "ghp_DEIN_TOKEN_HIER"   ← VOR DEM ERSTEN RUN ERSETZEN!
REPO         = "lenn-emm/tech-pulse"
SUPABASE_URL = "https://rjmyjuejdhcnijerwwwe.supabase.co"

WICHTIGE REGELN für Schreib-/Leseoperationen:
- Ausschließlich Python urllib. KEIN git, KEIN curl, KEIN subprocess, KEIN MCP-Push.
- Alle drei Alternativen scheitern in der Cloud-Umgebung mit 403 — verschwende keine Zeit.
- Nur die GitHub Contents API ist zuverlässig.

═══════════════════════════════════════════════════════════════
PYTHON-HELFER (am Anfang einmal definieren, dann verwenden)
═══════════════════════════════════════════════════════════════
  import urllib.request, json, base64, sys
  from urllib.error import HTTPError

  HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "TechPulse-Routine/3"
  }

  def gh_get(path):
      """Liest Datei aus dem Repo. Gibt (data, sha) oder (None, None) zurück."""
      url = f"https://api.github.com/repos/{REPO}/contents/{path}"
      try:
          r = urllib.request.Request(url, headers=HEADERS)
          resp = json.loads(urllib.request.urlopen(r, timeout=15).read())
          content = base64.b64decode(resp["content"]).decode("utf-8")
          return json.loads(content), resp["sha"]
      except HTTPError as e:
          if e.code == 404:
              return None, None
          raise

  def gh_put(path, payload, message):
      """Schreibt JSON-Datei ins Repo (create or update auf main)."""
      url = f"https://api.github.com/repos/{REPO}/contents/{path}"
      _, sha = gh_get(path)
      body = {
          "message": message,
          "content": base64.b64encode(
              json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
          ).decode("ascii"),
          "branch": "main"
      }
      if sha:
          body["sha"] = sha
      req = urllib.request.Request(
          url, data=json.dumps(body).encode(),
          headers={**HEADERS, "Content-Type": "application/json"},
          method="PUT"
      )
      return json.loads(urllib.request.urlopen(req, timeout=20).read())

═══════════════════════════════════════════════════════════════
SCHRITT 1 — DATUM
═══════════════════════════════════════════════════════════════
heute  = aktuelles Datum (Europe/Berlin) als YYYY-MM-DD
titel  = "Tech Pulse — <Wochentag>, DD. Monat YYYY"  (Deutsch)

═══════════════════════════════════════════════════════════════
SCHRITT 2 — IDEMPOTENZ-CHECK + DEDUP-DATEN LADEN
═══════════════════════════════════════════════════════════════
  # A) Ist heute schon eine Edition gepusht?
  existing, _ = gh_get("data/next-edition.json")
  if existing and existing.get("edition", {}).get("edition_date") == heute:
      print(f"Edition für {heute} existiert bereits. Abbruch.")
      sys.exit(0)

  # B) Bisherige Artikel laden (rollendes Fenster der letzten 80)
  recent, _ = gh_get("data/recent-articles.json")
  if recent is None:
      recent = {"articles": []}
  known_urls   = {a["source_url"] for a in recent["articles"]}
  known_titles = {a["title"].lower()[:40] for a in recent["articles"]}

═══════════════════════════════════════════════════════════════
SCHRITT 3 — RECHERCHE (WebSearch, kein WebFetch, kein curl)
═══════════════════════════════════════════════════════════════
Suche die wichtigsten KI- und Tech-News der letzten 24 Stunden via WebSearch.
Empfohlene Suchstrategien:

  Core      (KI-Labs):       "Anthropic news today" · "OpenAI announcement today"
                             "Google DeepMind today" · "Hugging Face release today"
  Adjacent  (Tech-Medien):   "The Verge AI today" · "TechCrunch AI today"
                             "Ars Technica AI today" · "MIT Tech Review AI"
  Outside   (Forschung):     "arxiv AI paper today" · "Nature AI research"
                             "Stratechery latest" · "Import AI newsletter"
  Wildcard  (Überraschung):  "Hacker News top AI today" · "404 Media tech today"
                             "Simon Willison blog latest"

Filtere konsequent:
- Nur Meldungen ≤ 24h alt
- Verwerfe wenn source_url in known_urls
- Verwerfe wenn title.lower()[:40] in known_titles
- Primärquelle bevorzugen, keine Aggregatoren

═══════════════════════════════════════════════════════════════
SCHRITT 4 — KURATIEREN
═══════════════════════════════════════════════════════════════
ARTIKELMIX (Pflicht):
  1× hero               (zone core/adjacent, Aufmacher des Tages)
  4–5× feature/visual   (Mischung aller Zonen)
  2–3× quick            (knapp, 1 Satz Headline + 1–2 Satz Summary)
  optional 1× quote     (markantes Zitat einer Person)

ZONEN-VERTEILUNG (Richtwert):
  core 40–50 % · adjacent 25–35 % · outside 15–20 % · wildcard 5–10 %

PRO ARTIKEL:
  title          max. 10 Wörter, kein Clickbait
  summary        2–3 Sätze: Was · Warum relevant · (Einordnung)
  source_url     direkter Link zur Primärquelle
  source_name    z.B. "The Verge"
  category       model_release | company_news | research | product | regulation
  format         hero | feature | visual | standard | quick | quote
  zone           core | adjacent | outside | wildcard
  read_time_min  1–10
  position       Reihenfolge nach Relevanz (1 = oben)
  (bei quote:    quote_text + quote_author zusätzlich)

KEIN image_url — Frontend nutzt automatische Zonen-Farbverläufe.

Falls nach Dedup < 5 brauchbare Artikel: Abbruch, nichts pushen.

═══════════════════════════════════════════════════════════════
SCHRITT 5 — JSON BAUEN & VALIDIEREN
═══════════════════════════════════════════════════════════════
  edition_payload = {
      "edition": {
          "title":        titel,
          "edition_date": heute,
          "summary":      "1–2 Sätze, was diese Edition ausmacht"
      },
      "articles": [ ... ]   # die kuratierten Artikel
  }

  # Validieren: round-trip durch json muss klappen
  json.loads(json.dumps(edition_payload, ensure_ascii=False))

Schema-Referenz: data/next-edition.schema.json im Repo.
Niemals JSON per String-Konkatenation bauen — immer json.dumps().

═══════════════════════════════════════════════════════════════
SCHRITT 6 — PUSH (zwei Dateien)
═══════════════════════════════════════════════════════════════
  # A) next-edition.json — triggert edition-publish.yml → Supabase-Write
  res_a = gh_put("data/next-edition.json", edition_payload, f"edition: {heute}")
  print("✓ next-edition.json:", res_a["content"]["html_url"])

  # B) recent-articles.json — neue Artikel vorne, alte dahinter, Cap auf 80
  new_recent_articles = [
      {"title": a["title"], "source_url": a["source_url"], "edition_date": heute}
      for a in edition_payload["articles"]
  ] + recent["articles"]
  recent_payload = {"articles": new_recent_articles[:80]}
  res_b = gh_put("data/recent-articles.json", recent_payload, f"recent: {heute}")
  print("✓ recent-articles.json:", res_b["content"]["html_url"])

FEHLERBEHANDLUNG:
- HTTP 401/403 beim Push  → Token ungültig oder ohne contents:write Scope.
                            STOP. Keine Workarounds. Klare Fehlermeldung ausgeben.
- HTTP 409 / 422 (SHA-Konflikt) → einmal gh_get neu, sha holen, gh_put wiederholen.
- Andere Fehler            → Stacktrace ausgeben, abbrechen.

ERFOLG:
Der Push von next-edition.json auf main triggert automatisch edition-publish.yml.
Der Workflow setzt die bisherige Edition auf is_current=false (NIEMALS löschen)
und schreibt die neue Edition + Artikel in Supabase. Editionen aus den Vorwochen
bleiben dauerhaft über archive.html erreichbar.
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
