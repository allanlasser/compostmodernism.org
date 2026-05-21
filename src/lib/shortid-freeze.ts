import type { Db } from './db';
import { encodeId } from './shortid';

// Iterates all posts and writes each one's current short-token into
// shortlink_redirects. Idempotent (the db function uses INSERT ... ON
// CONFLICT DO NOTHING). Run this before changing the Sqids config in
// shortid.ts — see NOTES.md.
export function freezeShortlinkTokens(db: Db): number {
	const rows = db.raw.prepare('SELECT id FROM posts').all() as { id: number }[];
	for (const { id } of rows) db.recordShortlinkRedirect(encodeId(id), id);
	return rows.length;
}
