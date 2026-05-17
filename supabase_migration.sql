-- Tech Pulse — Schema Migration v2
-- Magazin-Redesign: Format, Zone, Bild-Felder

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS zone TEXT NOT NULL DEFAULT 'core',
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS read_time_min INTEGER,
  ADD COLUMN IF NOT EXISTS quote_text TEXT,
  ADD COLUMN IF NOT EXISTS quote_author TEXT;

ALTER TABLE articles
  ADD CONSTRAINT articles_format_check
    CHECK (format IN ('hero', 'feature', 'standard', 'quick', 'quote', 'visual'));

ALTER TABLE articles
  ADD CONSTRAINT articles_zone_check
    CHECK (zone IN ('core', 'adjacent', 'outside', 'wildcard'));

-- Schnellerer Zugriff auf Hero-Artikel je Edition (Archiv-Seite)
CREATE INDEX IF NOT EXISTS articles_format_edition_idx
  ON articles (edition_id, format);

-- ── Video Pulse — Migration v3 ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS videos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id   TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  video_id     TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS videos_published_idx ON videos (published_at DESC);

-- ── Videos RLS — Migration v5 ───────────────────────────────────────────────
-- Frontend liest Videos anonym (Video-Pulse-Sektion); Workflow nutzt
-- service-role-key (umgeht RLS). Bisher war RLS deaktiviert → Supabase-Advisor
-- meldete "RLS Disabled in Public" für public.videos.

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS videos_anon_select ON videos;
CREATE POLICY videos_anon_select
  ON videos
  FOR SELECT
  TO anon
  USING (true);

-- ── Migration v7: Push-Funktionalität entfernen ────────────────────────────
-- Einmal im Supabase SQL-Editor ausführen, um die alten Push-Artefakte
-- aus dem Schema zu entfernen. Idempotent.

DROP FUNCTION IF EXISTS public.register_push(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.unregister_push(text, text);
DROP TABLE IF EXISTS public.push_subscriptions;
