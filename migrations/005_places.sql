-- Where a post was written. Coordinates stay server-side; public pages only
-- ever see name and slug.
CREATE TABLE IF NOT EXISTS places (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	name       TEXT    NOT NULL,
	slug       TEXT    NOT NULL UNIQUE,
	latitude   REAL    NOT NULL,
	longitude  REAL    NOT NULL,
	created_at INTEGER NOT NULL
);

ALTER TABLE posts ADD COLUMN place_id INTEGER REFERENCES places(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_place_id ON posts (place_id);
