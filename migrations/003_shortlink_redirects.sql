-- Frozen short-link tokens kept here so a future change to the Sqids encoder
-- config (alphabet, minLength) does not break links shared under an earlier
-- config. Normal operation reads nothing from this table — resolution decodes
-- the token directly and looks the post up by id. The /p/[token] endpoint
-- only consults this table on a decode miss, mirroring how the single-post
-- route falls back to slug_redirects on a 404.
--
-- Populated by `scripts/freeze-shortlink-tokens.ts`. Run that before any
-- change to src/lib/shortid.ts. See NOTES.md.
CREATE TABLE IF NOT EXISTS shortlink_redirects (
	id        INTEGER PRIMARY KEY AUTOINCREMENT,
	old_token TEXT    NOT NULL UNIQUE,
	post_id   INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE
);
