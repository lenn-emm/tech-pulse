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

-- ── Push Subscriptions — Migration v4 ───────────────────────────────────────
-- Speichert Web-Push-Subscriptions (PWA). Endpoint ist eindeutig pro Gerät;
-- bei Re-Subscription (z.B. nach Browser-Reset) per ON CONFLICT aktualisiert.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  topics      TEXT[] NOT NULL DEFAULT ARRAY['edition','video']::TEXT[],
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_topics_idx
  ON push_subscriptions USING GIN (topics);

-- RLS: Anonyme Clients dürfen sich subscriben/unsubscriben (nur eigener Endpoint),
-- aber NIEMALS andere Subscriptions lesen. Workflow nutzt service-role-key (umgeht RLS).

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_anon_insert ON push_subscriptions;
CREATE POLICY push_subscriptions_anon_insert
  ON push_subscriptions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Update erlaubt für upsert (ON CONFLICT … DO UPDATE),
-- aber nur am eigenen Endpoint — der Endpoint selbst darf nicht geändert werden.
DROP POLICY IF EXISTS push_subscriptions_anon_update ON push_subscriptions;
CREATE POLICY push_subscriptions_anon_update
  ON push_subscriptions
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS push_subscriptions_anon_delete ON push_subscriptions;
CREATE POLICY push_subscriptions_anon_delete
  ON push_subscriptions
  FOR DELETE
  TO anon
  USING (true);

-- Bewusst KEIN SELECT für anon — Subscriptions bleiben privat.

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

-- ── Push Subscriptions Hardening — Migration v6 ─────────────────────────────
-- Vorherige Policies erlaubten anon clients beliebige UPDATE/DELETE auf alle
-- Subscriptions (Push-Hijack-Risiko). Neuer Ansatz:
--   1. Direkter DML-Zugriff (INSERT/UPDATE/DELETE) für anon wird widerrufen.
--   2. Zwei SECURITY DEFINER RPCs kapseln Subscribe/Unsubscribe und prüfen ein
--      Client-Secret, das nur der jeweilige Browser im localStorage hält.
--   3. Service-Role-Key (Workflows) umgeht RLS weiterhin und kann Subscriptions
--      lesen/löschen (z.B. 410-Cleanup).
--
-- Bestehende Subscriptions werden verworfen — User abonnieren beim nächsten
-- Visit neu (akzeptiertes Migrations-Verhalten).

DROP POLICY IF EXISTS push_subscriptions_anon_insert ON push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_anon_update ON push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_anon_delete ON push_subscriptions;

DELETE FROM push_subscriptions;

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS client_secret TEXT NOT NULL;

-- register_push: Subscribe oder Re-Subscribe (idempotent).
-- Bei Conflict auf endpoint wird nur aktualisiert, wenn das mitgesendete
-- client_secret zum bereits gespeicherten passt — verhindert Hijack durch
-- fremde Clients, die einen Endpoint kennen aber kein Secret haben.
CREATE OR REPLACE FUNCTION register_push(
  p_endpoint     TEXT,
  p_p256dh       TEXT,
  p_auth         TEXT,
  p_user_agent   TEXT,
  p_client_secret TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_endpoint IS NULL OR p_p256dh IS NULL OR p_auth IS NULL OR p_client_secret IS NULL THEN
    RAISE EXCEPTION 'register_push: required field missing';
  END IF;

  INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent, client_secret)
  VALUES (p_endpoint, p_p256dh, p_auth, p_user_agent, p_client_secret)
  ON CONFLICT (endpoint) DO UPDATE
    SET p256dh        = EXCLUDED.p256dh,
        auth          = EXCLUDED.auth,
        user_agent    = EXCLUDED.user_agent,
        last_seen     = now()
    WHERE push_subscriptions.client_secret = EXCLUDED.client_secret;
END;
$$;

REVOKE ALL ON FUNCTION register_push(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_push(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;

-- unregister_push: Löscht nur, wenn das client_secret matched.
CREATE OR REPLACE FUNCTION unregister_push(
  p_endpoint      TEXT,
  p_client_secret TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_endpoint IS NULL OR p_client_secret IS NULL THEN
    RAISE EXCEPTION 'unregister_push: required field missing';
  END IF;

  DELETE FROM push_subscriptions
   WHERE endpoint = p_endpoint
     AND client_secret = p_client_secret;
END;
$$;

REVOKE ALL ON FUNCTION unregister_push(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION unregister_push(TEXT, TEXT) TO anon;

-- Bewusst KEINE neuen INSERT/UPDATE/DELETE-Policies für anon — Tabellen-DML
-- ist für anon damit komplett gesperrt, alles läuft über die zwei RPCs.
