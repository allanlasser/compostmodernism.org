import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb, type Db } from './db';
import { encodeId } from './shortid';
import { freezeShortlinkTokens } from './shortid-freeze';

let db: Db;

beforeEach(() => {
	vi.stubEnv('R2_PUBLIC_URL', 'https://images.test');
	db = createDb(':memory:');
});

describe('freezeShortlinkTokens', () => {
	it('writes one shortlink_redirects row per post with the current encoder token', () => {
		const ids = [
			db.insertPost({ body: 'a', title: 'A' }).id,
			db.insertPost({ body: 'b', title: 'B' }).id,
			db.insertPost({ body: 'c', title: 'C' }).id
		];

		const written = freezeShortlinkTokens(db);

		expect(written).toBe(3);
		for (const id of ids) {
			const found = db.getPostByOldToken(encodeId(id));
			expect(found?.id).toBe(id);
		}
	});

	it('is idempotent: re-running does not duplicate or fail', () => {
		const { id } = db.insertPost({ body: 'a', title: 'A' });
		freezeShortlinkTokens(db);
		expect(() => freezeShortlinkTokens(db)).not.toThrow();

		const rows = db.raw
			.prepare('SELECT COUNT(*) AS n FROM shortlink_redirects WHERE post_id = ?')
			.get(id) as { n: number };
		expect(rows.n).toBe(1);
	});

	it('returns 0 when there are no posts', () => {
		expect(freezeShortlinkTokens(db)).toBe(0);
	});
});
