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

## Prompt 2 — Neue Edition erstellen (wöchentlich)

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
