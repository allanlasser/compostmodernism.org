-- Where a post was written. Posts sharing a place_slug share a place page.
-- Coordinates stay server-side; public pages only ever see name and slug.
ALTER TABLE posts ADD COLUMN latitude   REAL;
ALTER TABLE posts ADD COLUMN longitude  REAL;
ALTER TABLE posts ADD COLUMN place_name TEXT;
ALTER TABLE posts ADD COLUMN place_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_place_slug ON posts (place_slug);
