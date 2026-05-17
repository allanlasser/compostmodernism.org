CREATE TABLE IF NOT EXISTS posts (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	slug       TEXT    NOT NULL UNIQUE,
	body       TEXT    NOT NULL,
	title      TEXT,
	url        TEXT,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
	id   INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT    NOT NULL UNIQUE,
	slug TEXT    NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS post_tags (
	post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
	tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
	PRIMARY KEY (post_id, tag_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_slug ON posts (slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_slug  ON tags  (slug);

-- ── Image ledger (Phase 9) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS images (
	id          INTEGER PRIMARY KEY AUTOINCREMENT,
	key         TEXT    NOT NULL UNIQUE,
	uploaded_at INTEGER NOT NULL,
	title       TEXT,
	alt         TEXT,
	caption     TEXT,
	credit      TEXT
);

CREATE TABLE IF NOT EXISTS post_images (
	post_id  INTEGER NOT NULL REFERENCES posts(id)  ON DELETE CASCADE,
	image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
	PRIMARY KEY (post_id, image_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_images_key ON images (key);
