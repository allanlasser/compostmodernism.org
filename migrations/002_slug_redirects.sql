-- Ledger of every (year, month, day, slug) path a post used to live at.
-- Consulted on 404 from the single-post route; matches issue a 301 to the
-- post's current canonical URL. Rows point to post_id (not a path string) so
-- successive renames automatically follow through without chain walking.
CREATE TABLE IF NOT EXISTS slug_redirects (
	id        INTEGER PRIMARY KEY AUTOINCREMENT,
	old_year  INTEGER NOT NULL,
	old_month INTEGER NOT NULL,
	old_day   INTEGER NOT NULL,
	old_slug  TEXT    NOT NULL,
	post_id   INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
	UNIQUE (old_year, old_month, old_day, old_slug)
);

CREATE INDEX IF NOT EXISTS idx_slug_redirects_lookup
	ON slug_redirects (old_year, old_month, old_day, old_slug);
