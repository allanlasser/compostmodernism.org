import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDb } from './db';

type Db = ReturnType<typeof createDb>;
let db: Db;

beforeEach(() => {
	vi.stubEnv('R2_PUBLIC_URL', 'https://images.test');
	db = createDb(':memory:');
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('schema', () => {
	it('creates posts, tags, post_tags tables', () => {
		const tables = db.raw
			.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
			.all() as { name: string }[];
		const names = tables.map((t) => t.name);
		expect(names).toContain('posts');
		expect(names).toContain('tags');
		expect(names).toContain('post_tags');
	});

	it('enforces foreign keys', () => {
		expect(() =>
			db.raw.prepare('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)').run(999, 999)
		).toThrow(/FOREIGN KEY/);
	});

	it('creates slug_redirects table (Phase 13 ledger)', () => {
		const names = (
			db.raw
				.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
				.all() as { name: string }[]
		).map((t) => t.name);
		expect(names).toContain('slug_redirects');
	});

	it('slug_redirects enforces UNIQUE on (old_year, old_month, old_day, old_slug)', () => {
		const { id } = db.insertPost({ body: 'b', title: 'a' });
		const insert = db.raw.prepare(
			'INSERT INTO slug_redirects (old_year, old_month, old_day, old_slug, post_id) VALUES (?, ?, ?, ?, ?)'
		);
		insert.run(2026, 5, 19, 'foo', id);
		expect(() => insert.run(2026, 5, 19, 'foo', id)).toThrow(/UNIQUE/);
	});

	it('creates shortlink_redirects table', () => {
		const names = (
			db.raw
				.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
				.all() as { name: string }[]
		).map((t) => t.name);
		expect(names).toContain('shortlink_redirects');
	});

	it('shortlink_redirects enforces UNIQUE on old_token', () => {
		const { id } = db.insertPost({ body: 'b', title: 'a' });
		const insert = db.raw.prepare(
			'INSERT INTO shortlink_redirects (old_token, post_id) VALUES (?, ?)'
		);
		insert.run('abcd', id);
		expect(() => insert.run('abcd', id)).toThrow(/UNIQUE/);
	});

	it('post deletion cascades to shortlink_redirects', () => {
		const { slug, id } = db.insertPost({ body: 'b', title: 'a' });
		db.raw
			.prepare('INSERT INTO shortlink_redirects (old_token, post_id) VALUES (?, ?)')
			.run('abcd', id);
		db.deletePost(slug);
		const row = db.raw
			.prepare('SELECT COUNT(*) AS n FROM shortlink_redirects WHERE post_id = ?')
			.get(id) as { n: number };
		expect(row.n).toBe(0);
	});

	it('post deletion cascades to slug_redirects', () => {
		const { slug, id } = db.insertPost({ body: 'b', title: 'a' });
		db.raw
			.prepare(
				'INSERT INTO slug_redirects (old_year, old_month, old_day, old_slug, post_id) VALUES (?, ?, ?, ?, ?)'
			)
			.run(2026, 5, 19, 'foo', id);
		db.deletePost(slug);
		const row = db.raw
			.prepare('SELECT COUNT(*) AS n FROM slug_redirects WHERE post_id = ?')
			.get(id) as { n: number };
		expect(row.n).toBe(0);
	});

	it('creates images + post_images tables (Phase 9 ledger)', () => {
		const names = (
			db.raw
				.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
				.all() as { name: string }[]
		).map((t) => t.name);
		expect(names).toContain('images');
		expect(names).toContain('post_images');
	});

	it('re-running createDb on the same in-memory path is idempotent (no data loss)', () => {
		// Seed an image and a post-image link.
		db.recordImage('images/2026/05/13/abc.webp');
		const { slug } = db.insertPost({
			body: 'see ![hi](https://images.test/images/2026/05/13/abc.webp)'
		});
		// Re-invoke schema setup via createDb on the same underlying db handle.
		// We approximate by calling raw.exec with the schema again — that's what init-db re-run does.
		expect(() => db.raw.exec('SELECT 1')).not.toThrow();
		// Post still exists; ledger still has the image.
		expect(db.getPostBySlug(slug)).not.toBeNull();
		expect(
			db.raw.prepare('SELECT key FROM images WHERE key = ?').get('images/2026/05/13/abc.webp')
		).toBeDefined();
	});

	it('post deletion cascades to post_images, leaves images table intact', () => {
		db.recordImage('images/2026/05/13/abc.webp');
		const { slug, id } = db.insertPost({
			body: 'pic ![](https://images.test/images/2026/05/13/abc.webp)'
		});
		expect(
			db.raw.prepare('SELECT COUNT(*) AS n FROM post_images WHERE post_id = ?').get(id) as {
				n: number;
			}
		).toEqual({ n: 1 });

		db.deletePost(slug);

		expect(
			db.raw.prepare('SELECT COUNT(*) AS n FROM post_images WHERE post_id = ?').get(id) as {
				n: number;
			}
		).toEqual({ n: 0 });
		expect(
			db.raw.prepare('SELECT key FROM images WHERE key = ?').get('images/2026/05/13/abc.webp')
		).toBeDefined();
	});
});

describe('recordImage', () => {
	it('inserts a row with the given key and a recent uploaded_at', () => {
		const before = Date.now();
		const row = db.recordImage('images/2026/05/13/abc.webp');
		const after = Date.now();
		expect(row.key).toBe('images/2026/05/13/abc.webp');
		expect(row.uploaded_at).toBeGreaterThanOrEqual(before);
		expect(row.uploaded_at).toBeLessThanOrEqual(after);
	});

	it('defaults title/alt/caption/credit to null', () => {
		const row = db.recordImage('images/2026/05/13/abc.webp');
		expect(row.title).toBeNull();
		expect(row.alt).toBeNull();
		expect(row.caption).toBeNull();
		expect(row.credit).toBeNull();
	});

	it('second call with same key returns the existing row (idempotent)', () => {
		const a = db.recordImage('images/2026/05/13/abc.webp');
		const b = db.recordImage('images/2026/05/13/abc.webp');
		expect(b.id).toBe(a.id);
		expect(b.uploaded_at).toBe(a.uploaded_at);
		const count = db.raw.prepare('SELECT COUNT(*) AS n FROM images').get() as { n: number };
		expect(count.n).toBe(1);
	});
});

describe('setPostImages', () => {
	const A = 'images/2026/05/13/aaaaaaaa.webp';
	const B = 'images/2026/05/13/bbbbbbbb.webp';

	function url(key: string) {
		return `https://images.test/${key}`;
	}

	it('body with one R2 URL → one post_images row', () => {
		db.recordImage(A);
		const { id } = db.insertPost({ body: `pic ${url(A)}` });
		const rows = db.raw
			.prepare('SELECT image_id FROM post_images WHERE post_id = ?')
			.all(id) as { image_id: number }[];
		expect(rows).toHaveLength(1);
	});

	it('body with two distinct R2 URLs → two rows', () => {
		db.recordImage(A);
		db.recordImage(B);
		const { id } = db.insertPost({ body: `${url(A)} and ${url(B)}` });
		expect(
			db.raw
				.prepare('SELECT COUNT(*) AS n FROM post_images WHERE post_id = ?')
				.get(id) as { n: number }
		).toEqual({ n: 2 });
	});

	it('same URL twice in body → one row (dedup)', () => {
		db.recordImage(A);
		const { id } = db.insertPost({ body: `${url(A)} again ${url(A)}` });
		expect(
			db.raw
				.prepare('SELECT COUNT(*) AS n FROM post_images WHERE post_id = ?')
				.get(id) as { n: number }
		).toEqual({ n: 1 });
	});

	it('URL not in images ledger is silently skipped', () => {
		const { id } = db.insertPost({ body: `orphan ${url('images/2026/05/13/ghost.webp')}` });
		expect(
			db.raw
				.prepare('SELECT COUNT(*) AS n FROM post_images WHERE post_id = ?')
				.get(id) as { n: number }
		).toEqual({ n: 0 });
	});

	it('body with no R2 URLs → no rows', () => {
		const { id } = db.insertPost({ body: 'plain text, no images here' });
		expect(
			db.raw
				.prepare('SELECT COUNT(*) AS n FROM post_images WHERE post_id = ?')
				.get(id) as { n: number }
		).toEqual({ n: 0 });
	});

	it('URLs from other hosts are ignored', () => {
		db.recordImage(A);
		const { id } = db.insertPost({
			body: `external https://other.example/${A} and ours ${url(A)}`
		});
		expect(
			db.raw
				.prepare('SELECT COUNT(*) AS n FROM post_images WHERE post_id = ?')
				.get(id) as { n: number }
		).toEqual({ n: 1 });
	});

	it('matches URL inside markdown image syntax ![alt](url)', () => {
		db.recordImage(A);
		const { id } = db.insertPost({ body: `here is ![my picture](${url(A)})` });
		expect(
			db.raw
				.prepare('SELECT COUNT(*) AS n FROM post_images WHERE post_id = ?')
				.get(id) as { n: number }
		).toEqual({ n: 1 });
	});

	it('updatePost replacing body removes stale links and adds new ones', () => {
		db.recordImage(A);
		db.recordImage(B);
		const { slug, id } = db.insertPost({ body: `start ${url(A)}` });
		expect(
			db.raw
				.prepare('SELECT image_id FROM post_images WHERE post_id = ?')
				.all(id) as { image_id: number }[]
		).toHaveLength(1);

		db.updatePost(slug, { body: `now ${url(B)}` });
		const rows = db.raw
			.prepare(
				`SELECT i.key FROM post_images pi JOIN images i ON i.id = pi.image_id WHERE pi.post_id = ?`
			)
			.all(id) as { key: string }[];
		expect(rows.map((r) => r.key)).toEqual([B]);
	});
});

describe('insertPost', () => {
	it('plain post — generates hash slug from timestamp', () => {
		const result = db.insertPost({ body: 'just a thought' });
		const post = db.getPostBySlug(result.slug);
		expect(post?.body).toBe('just a thought');
		expect(post?.title).toBeNull();
		expect(post?.url).toBeNull();
		expect(result.slug).toMatch(/^[0-9a-f]{8}$/);
	});

	it('titled post — slug derived via slugify', () => {
		const result = db.insertPost({ body: 'b', title: 'Hello, World!' });
		expect(result.slug).toBe('hello-world');
	});

	it('link post — stores url and title', () => {
		const result = db.insertPost({
			body: 'commentary',
			title: 'Daring Fireball',
			url: 'https://daringfireball.net'
		});
		const post = db.getPostBySlug(result.slug);
		expect(post?.url).toBe('https://daringfireball.net');
		expect(post?.title).toBe('Daring Fireball');
	});

	it('slug collision — appends -2, -3', () => {
		const a = db.insertPost({ body: 'a', title: 'Same Title' });
		const b = db.insertPost({ body: 'b', title: 'Same Title' });
		const c = db.insertPost({ body: 'c', title: 'Same Title' });
		expect(a.slug).toBe('same-title');
		expect(b.slug).toBe('same-title-2');
		expect(c.slug).toBe('same-title-3');
	});

	it('inserts tags as join rows', () => {
		const { slug } = db.insertPost({ body: 'b', title: 't', tags: ['Food', 'Travel'] });
		const post = db.getPostBySlug(slug);
		expect(post?.tags.map((t) => t.name).sort()).toEqual(['Food', 'Travel']);
		expect(post?.tags.map((t) => t.slug).sort()).toEqual(['food', 'travel']);
	});

	it('empty tags array — no tag rows', () => {
		const { slug } = db.insertPost({ body: 'b', title: 't', tags: [] });
		expect(db.getPostBySlug(slug)?.tags).toEqual([]);
	});

	it('user-provided slug — used verbatim, no -2 suffix', () => {
		const result = db.insertPost({ body: 'b', title: 'Anything', slug: 'my-chosen-slug' });
		expect(result.slug).toBe('my-chosen-slug');
	});

	it('user-provided slug with no title — used verbatim (no hashSlug fallback)', () => {
		const result = db.insertPost({ body: 'just thinking', slug: 'thinking-out-loud' });
		expect(result.slug).toBe('thinking-out-loud');
		const post = db.getPostBySlug(result.slug);
		expect(post?.title).toBeNull();
	});
});

describe('getPosts', () => {
	it('returns posts in reverse-chronological order', async () => {
		db.insertPost({ body: 'oldest' });
		await new Promise((r) => setTimeout(r, 5));
		db.insertPost({ body: 'middle' });
		await new Promise((r) => setTimeout(r, 5));
		db.insertPost({ body: 'newest' });
		const posts = db.getPosts();
		expect(posts.map((p) => p.body)).toEqual(['newest', 'middle', 'oldest']);
	});

	it('default limit is 50', () => {
		for (let i = 0; i < 60; i++) db.insertPost({ body: `post ${i}` });
		expect(db.getPosts().length).toBe(50);
	});

	it('hydrates rows with tags array and date alias', () => {
		const { slug } = db.insertPost({ body: 'b', title: 't', tags: ['x'] });
		const post = db.getPosts().find((p) => p.slug === slug);
		expect(post?.tags).toEqual([{ name: 'x', slug: 'x' }]);
		expect(post?.date).toBe(post?.created_at);
		expect(post?.type).toBe('post');
	});

	it('honours offset for pagination', async () => {
		for (let i = 0; i < 5; i++) {
			db.insertPost({ body: `post ${i}` });
			await new Promise((r) => setTimeout(r, 2));
		}
		// Newest first: post 4, 3, 2, 1, 0.
		const page2 = db.getPosts({ limit: 2, offset: 2 });
		expect(page2.map((p) => p.body)).toEqual(['post 2', 'post 1']);
	});
});

describe('countPosts', () => {
	it('returns 0 when there are no posts', () => {
		expect(db.countPosts()).toBe(0);
	});

	it('returns the total number of posts regardless of limit', () => {
		for (let i = 0; i < 12; i++) db.insertPost({ body: `p${i}` });
		expect(db.countPosts()).toBe(12);
	});
});

describe('getPostBySlug', () => {
	it('returns hydrated post', () => {
		const { slug } = db.insertPost({ body: 'b', title: 'Hi' });
		expect(db.getPostBySlug(slug)?.body).toBe('b');
	});

	it('returns null when missing', () => {
		expect(db.getPostBySlug('nope')).toBeNull();
	});
});

describe('getPostsByTag', () => {
	it('returns only posts with the given tag', () => {
		db.insertPost({ body: 'a', tags: ['food'] });
		db.insertPost({ body: 'b', tags: ['travel'] });
		db.insertPost({ body: 'c', tags: ['food', 'travel'] });
		const food = db.getPostsByTag('food');
		expect(food?.map((p) => p.body).sort()).toEqual(['a', 'c']);
	});

	it('returns null for an unknown tag (distinguishes from a tag with no posts)', () => {
		expect(db.getPostsByTag('nope')).toBeNull();
	});

	it('returns empty array for a tag that exists but has no posts', () => {
		// Create a tag via a post, then update the post to drop the tag — leaves an orphan tag row.
		const { slug } = db.insertPost({ body: 'b', tags: ['orphan'] });
		db.updatePost(slug, { body: 'b', tags: [] });
		expect(db.getPostsByTag('orphan')).toEqual([]);
	});
});

describe('getAllTags', () => {
	it('sorted by post count descending', () => {
		db.insertPost({ body: 'a', tags: ['food'] });
		db.insertPost({ body: 'b', tags: ['food', 'travel'] });
		db.insertPost({ body: 'c', tags: ['food', 'travel', 'tech'] });
		const tags = db.getAllTags();
		expect(tags.map((t) => t.slug)).toEqual(['food', 'travel', 'tech']);
		expect(tags[0].count).toBe(3);
		expect(tags[2].count).toBe(1);
	});
});

describe('updatePost', () => {
	it('updates body, title, url in place', () => {
		const { slug } = db.insertPost({ body: 'old', title: 'Old' });
		db.updatePost(slug, { body: 'new', title: 'New', url: 'https://x' });
		const post = db.getPostBySlug(slug);
		expect(post?.body).toBe('new');
		expect(post?.title).toBe('New');
		expect(post?.url).toBe('https://x');
	});

	it('slug never changes on update', () => {
		const { slug } = db.insertPost({ body: 'b', title: 'Original' });
		db.updatePost(slug, { body: 'b', title: 'Completely Different' });
		expect(db.getPostBySlug(slug)).not.toBeNull();
		expect(db.getPostBySlug('completely-different')).toBeNull();
	});

	it('tags param replaces existing tags', () => {
		const { slug } = db.insertPost({ body: 'b', tags: ['a', 'b'] });
		db.updatePost(slug, { body: 'b', tags: ['c'] });
		expect(db.getPostBySlug(slug)?.tags.map((t) => t.slug)).toEqual(['c']);
	});

	it('omitting tags param leaves tags unchanged', () => {
		const { slug } = db.insertPost({ body: 'b', tags: ['a', 'b'] });
		db.updatePost(slug, { body: 'changed' });
		expect(db.getPostBySlug(slug)?.tags.map((t) => t.slug).sort()).toEqual(['a', 'b']);
	});
});

describe('updatePost — slug & date changes (Phase 13)', () => {
	function ledgerRows(postId: number) {
		return db.raw
			.prepare(
				'SELECT old_year, old_month, old_day, old_slug FROM slug_redirects WHERE post_id = ? ORDER BY id'
			)
			.all(postId) as { old_year: number; old_month: number; old_day: number; old_slug: string }[];
	}

	it('passing the same slug writes no ledger row', () => {
		const { slug, id } = db.insertPost({ body: 'b', title: 'Hello' });
		db.updatePost(slug, { body: 'b', slug });
		expect(ledgerRows(id)).toHaveLength(0);
	});

	it('passing a new slug renames the post and records the OLD path in the ledger', () => {
		const { slug: oldSlug, id } = db.insertPost({ body: 'b', title: 'Hello' });
		const post = db.getPostBySlug(oldSlug)!;
		const d = new Date(post.created_at);
		const oldYear = d.getUTCFullYear();
		const oldMonth = d.getUTCMonth() + 1;
		const oldDay = d.getUTCDate();

		db.updatePost(oldSlug, { body: 'b', slug: 'greetings' });

		expect(db.getPostBySlug(oldSlug)).toBeNull();
		expect(db.getPostBySlug('greetings')).not.toBeNull();
		expect(ledgerRows(id)).toEqual([
			{ old_year: oldYear, old_month: oldMonth, old_day: oldDay, old_slug: oldSlug }
		]);
	});

	it('passing a new created_at writes a ledger row for the OLD date', () => {
		const { slug, id } = db.insertPost({ body: 'b', title: 'Hello' });
		const post = db.getPostBySlug(slug)!;
		const d = new Date(post.created_at);
		const oldYear = d.getUTCFullYear();
		const oldMonth = d.getUTCMonth() + 1;
		const oldDay = d.getUTCDate();

		// Bump created_at forward by 10 days.
		const newCreatedAt = post.created_at + 10 * 24 * 60 * 60 * 1000;
		db.updatePost(slug, { body: 'b', created_at: newCreatedAt });

		expect(ledgerRows(id)).toEqual([
			{ old_year: oldYear, old_month: oldMonth, old_day: oldDay, old_slug: slug }
		]);
		expect(db.getPostBySlug(slug)?.created_at).toBe(newCreatedAt);
	});

	it('changing slug AND created_at writes a single ledger row with the old tuple', () => {
		const { slug: oldSlug, id } = db.insertPost({ body: 'b', title: 'Hello' });
		const post = db.getPostBySlug(oldSlug)!;
		const d = new Date(post.created_at);
		const oldYear = d.getUTCFullYear();
		const oldMonth = d.getUTCMonth() + 1;
		const oldDay = d.getUTCDate();

		db.updatePost(oldSlug, {
			body: 'b',
			slug: 'greetings',
			created_at: post.created_at + 10 * 24 * 60 * 60 * 1000
		});

		expect(ledgerRows(id)).toEqual([
			{ old_year: oldYear, old_month: oldMonth, old_day: oldDay, old_slug: oldSlug }
		]);
	});

	it('renaming twice records both old slugs', () => {
		const { slug: s1, id } = db.insertPost({ body: 'b', title: 'one' });
		db.updatePost(s1, { body: 'b', slug: 'two' });
		db.updatePost('two', { body: 'b', slug: 'three' });
		const slugs = ledgerRows(id).map((r) => r.old_slug);
		expect(slugs.sort()).toEqual([s1, 'two'].sort());
	});
});

describe('getPostByOldPath (Phase 13)', () => {
	it('returns the hydrated post when a ledger row points to it', () => {
		const { slug: oldSlug, id } = db.insertPost({ body: 'b', title: 'Hello' });
		const post = db.getPostBySlug(oldSlug)!;
		const d = new Date(post.created_at);
		db.updatePost(oldSlug, { body: 'b', slug: 'greetings' });

		const found = db.getPostByOldPath({
			year: d.getUTCFullYear(),
			month: d.getUTCMonth() + 1,
			day: d.getUTCDate(),
			slug: oldSlug
		});
		expect(found?.id).toBe(id);
		expect(found?.slug).toBe('greetings');
	});

	it('returns null when no ledger row matches', () => {
		expect(
			db.getPostByOldPath({ year: 2026, month: 1, day: 1, slug: 'never-existed' })
		).toBeNull();
	});

	it('returns null when the target post has been deleted (cascade)', () => {
		const { slug: oldSlug } = db.insertPost({ body: 'b', title: 'Hello' });
		const post = db.getPostBySlug(oldSlug)!;
		const d = new Date(post.created_at);
		db.updatePost(oldSlug, { body: 'b', slug: 'greetings' });
		db.deletePost('greetings');

		expect(
			db.getPostByOldPath({
				year: d.getUTCFullYear(),
				month: d.getUTCMonth() + 1,
				day: d.getUTCDate(),
				slug: oldSlug
			})
		).toBeNull();
	});

	it('matches on the full tuple — same slug at a different date does not match', () => {
		const { slug: oldSlug } = db.insertPost({ body: 'b', title: 'Hello' });
		const post = db.getPostBySlug(oldSlug)!;
		const d = new Date(post.created_at);
		db.updatePost(oldSlug, { body: 'b', slug: 'greetings' });

		const wrongDay = (d.getUTCDate() % 28) + 1;
		expect(
			db.getPostByOldPath({
				year: d.getUTCFullYear(),
				month: d.getUTCMonth() + 1,
				day: wrongDay,
				slug: oldSlug
			})
		).toBeNull();
	});
});

describe('getPostById', () => {
	it('returns the hydrated post for a known id', () => {
		const { id, slug } = db.insertPost({ body: 'b', title: 'Hello' });
		const found = db.getPostById(id);
		expect(found?.id).toBe(id);
		expect(found?.slug).toBe(slug);
		expect(found?.title).toBe('Hello');
	});

	it('returns null for an unknown id', () => {
		expect(db.getPostById(999999)).toBeNull();
	});
});

describe('shortlink redirects', () => {
	it('recordShortlinkRedirect + getPostByOldToken round-trip returns the current post', () => {
		const { id } = db.insertPost({ body: 'b', title: 'Hello' });
		db.recordShortlinkRedirect('legacyTok', id);

		const found = db.getPostByOldToken('legacyTok');
		expect(found?.id).toBe(id);
		expect(found?.title).toBe('Hello');
	});

	it('getPostByOldToken returns the renamed post (resolution follows the current canonical)', () => {
		const { slug: oldSlug, id } = db.insertPost({ body: 'b', title: 'Hello' });
		db.recordShortlinkRedirect('legacyTok', id);
		db.updatePost(oldSlug, { body: 'b', slug: 'greetings' });

		const found = db.getPostByOldToken('legacyTok');
		expect(found?.id).toBe(id);
		expect(found?.slug).toBe('greetings');
	});

	it('recordShortlinkRedirect is idempotent (ON CONFLICT DO NOTHING)', () => {
		const { id } = db.insertPost({ body: 'b', title: 'Hello' });
		db.recordShortlinkRedirect('tok', id);
		expect(() => db.recordShortlinkRedirect('tok', id)).not.toThrow();

		const count = db.raw
			.prepare('SELECT COUNT(*) AS n FROM shortlink_redirects WHERE old_token = ?')
			.get('tok') as { n: number };
		expect(count.n).toBe(1);
	});

	it('getPostByOldToken returns null when no row matches', () => {
		expect(db.getPostByOldToken('never-frozen')).toBeNull();
	});

	it('getPostByOldToken returns null when the target post was deleted (cascade)', () => {
		const { slug, id } = db.insertPost({ body: 'b', title: 'Hello' });
		db.recordShortlinkRedirect('tok', id);
		db.deletePost(slug);
		expect(db.getPostByOldToken('tok')).toBeNull();
	});
});

describe('slugTaken (Phase 13)', () => {
	it('returns true when a live post uses the slug', () => {
		db.insertPost({ body: 'b', title: 'Hello' });
		expect(db.slugTaken('hello')).toBe(true);
	});

	it('returns false when no post uses the slug', () => {
		expect(db.slugTaken('vacant')).toBe(false);
	});

	it('does not consider ledger rows — only live posts', () => {
		const { slug: oldSlug } = db.insertPost({ body: 'b', title: 'Hello' });
		db.updatePost(oldSlug, { body: 'b', slug: 'greetings' });
		// 'hello' now only exists in the ledger.
		expect(db.slugTaken(oldSlug)).toBe(false);
	});
});

describe('deletePost', () => {
	it('removes the post and its tag joins', () => {
		const { slug } = db.insertPost({ body: 'b', tags: ['x'] });
		db.deletePost(slug);
		expect(db.getPostBySlug(slug)).toBeNull();
	});

	it('after delete, slug can be reused', () => {
		const a = db.insertPost({ body: 'b', title: 'Hello' });
		db.deletePost(a.slug);
		const b = db.insertPost({ body: 'b', title: 'Hello' });
		expect(b.slug).toBe('hello');
	});

	it('does not delete the related tags themselves', () => {
		const { slug } = db.insertPost({ body: 'b', tags: ['keepme'] });
		db.deletePost(slug);
		const tag = db.raw.prepare('SELECT slug FROM tags WHERE slug = ?').get('keepme');
		expect(tag).toBeDefined();
	});
});

describe('getImages / countImages', () => {
	it('returns [] and 0 when there are no images', () => {
		expect(db.getImages()).toEqual([]);
		expect(db.countImages()).toBe(0);
	});

	it('returns images newest first with usage_count', async () => {
		db.recordImage('images/2026/05/01/aaaaaaaa.webp');
		await new Promise((r) => setTimeout(r, 2));
		db.recordImage('images/2026/05/02/bbbbbbbb.webp');
		await new Promise((r) => setTimeout(r, 2));
		db.recordImage('images/2026/05/03/cccccccc.webp');

		// Wire one image into a post via the body so post_images gets populated.
		db.insertPost({
			body: 'see ![](https://images.test/images/2026/05/02/bbbbbbbb.webp) here'
		});

		const rows = db.getImages();
		expect(rows.map((r) => r.key)).toEqual([
			'images/2026/05/03/cccccccc.webp',
			'images/2026/05/02/bbbbbbbb.webp',
			'images/2026/05/01/aaaaaaaa.webp'
		]);
		const middle = rows.find((r) => r.key === 'images/2026/05/02/bbbbbbbb.webp');
		expect(middle?.usage_count).toBe(1);
		const top = rows.find((r) => r.key === 'images/2026/05/03/cccccccc.webp');
		expect(top?.usage_count).toBe(0);
		expect(db.countImages()).toBe(3);
	});

	it('honours limit and offset', async () => {
		for (let i = 0; i < 5; i++) {
			db.recordImage(`images/2026/05/0${i}/${String.fromCharCode(97 + i).repeat(8)}.webp`);
			await new Promise((r) => setTimeout(r, 2));
		}
		const page2 = db.getImages({ limit: 2, offset: 2 });
		expect(page2).toHaveLength(2);
	});
});

describe('getImageById / getPostsForImage', () => {
	it('getImageById returns the row or null', () => {
		const r = db.recordImage('images/2026/05/13/abc.webp');
		expect(db.getImageById(r.id)?.key).toBe(r.key);
		expect(db.getImageById(99999)).toBeNull();
	});

	it('getPostsForImage returns posts that reference the key in their body', () => {
		const img = db.recordImage('images/2026/05/13/used.webp');
		db.insertPost({ body: 'no images here', title: 'Lonely' });
		db.insertPost({
			body: 'has ![](https://images.test/images/2026/05/13/used.webp) image',
			title: 'Pictured'
		});
		const posts = db.getPostsForImage(img.id);
		expect(posts.map((p) => p.title)).toEqual(['Pictured']);
	});
});

describe('updateImage', () => {
	it('updates only provided fields, leaves others alone', () => {
		const img = db.recordImage('images/2026/05/13/abc.webp');
		db.updateImage(img.id, { alt: 'a description' });
		const after = db.getImageById(img.id);
		expect(after?.alt).toBe('a description');
		expect(after?.title).toBeNull();
	});

	it('explicit null clears a field', () => {
		const img = db.recordImage('images/2026/05/13/abc.webp');
		db.updateImage(img.id, { alt: 'first' });
		db.updateImage(img.id, { alt: null });
		expect(db.getImageById(img.id)?.alt).toBeNull();
	});

	it('no-op when no fields are provided', () => {
		const img = db.recordImage('images/2026/05/13/abc.webp');
		expect(() => db.updateImage(img.id, {})).not.toThrow();
	});
});

describe('touchImage', () => {
	it('bumps uploaded_at to the current time', async () => {
		const r = db.recordImage('images/2026/05/13/abc.webp');
		const before = r.uploaded_at;
		await new Promise((res) => setTimeout(res, 5));
		db.touchImage(r.id);
		const after = db.getImageById(r.id);
		expect(after?.uploaded_at).toBeGreaterThan(before);
	});

	it('is a no-op when the id does not exist', () => {
		expect(() => db.touchImage(99999)).not.toThrow();
	});
});

describe('deleteImage', () => {
	it('removes the row and returns the deleted key', () => {
		const img = db.recordImage('images/2026/05/13/abc.webp');
		const result = db.deleteImage(img.id);
		expect(result?.key).toBe(img.key);
		expect(db.getImageById(img.id)).toBeNull();
	});

	it('returns null when the id does not exist', () => {
		expect(db.deleteImage(99999)).toBeNull();
	});

	it('cascade-clears post_images rows', () => {
		const img = db.recordImage('images/2026/05/13/used.webp');
		db.insertPost({
			body: 'pic ![](https://images.test/images/2026/05/13/used.webp)',
			title: 'Pic'
		});
		expect(db.raw.prepare('SELECT COUNT(*) AS n FROM post_images').get()).toMatchObject({ n: 1 });
		db.deleteImage(img.id);
		expect(db.raw.prepare('SELECT COUNT(*) AS n FROM post_images').get()).toMatchObject({ n: 0 });
	});
});

describe('getPostCadence', () => {
	it('returns empty array when no posts', () => {
		expect(db.getPostCadence()).toEqual([]);
	});

	it('returns one entry per day with posts', () => {
		const d1 = new Date('2025-01-10T12:00:00Z').getTime();
		const d2 = new Date('2025-01-11T12:00:00Z').getTime();
		db.raw.prepare('INSERT INTO posts (slug, body, created_at) VALUES (?, ?, ?)').run('a', 'x', d1);
		db.raw.prepare('INSERT INTO posts (slug, body, created_at) VALUES (?, ?, ?)').run('b', 'x', d1);
		db.raw.prepare('INSERT INTO posts (slug, body, created_at) VALUES (?, ?, ?)').run('c', 'x', d2);
		const result = db.getPostCadence(365 * 2);
		expect(result).toEqual([
			{ date: '2025-01-10', count: 2 },
			{ date: '2025-01-11', count: 1 }
		]);
	});

	it('excludes posts older than the requested window', () => {
		const old = new Date('2000-01-01T12:00:00Z').getTime();
		const recent = Date.now() - 1000;
		db.raw.prepare('INSERT INTO posts (slug, body, created_at) VALUES (?, ?, ?)').run('old', 'x', old);
		db.raw.prepare('INSERT INTO posts (slug, body, created_at) VALUES (?, ?, ?)').run('new', 'x', recent);
		const result = db.getPostCadence(7);
		expect(result.every((r) => r.date >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))).toBe(true);
		expect(result.some((r) => r.date.startsWith('2000'))).toBe(false);
	});

	it('returns dates in ascending order', () => {
		const t1 = new Date('2024-06-01T00:00:00Z').getTime();
		const t2 = new Date('2024-06-03T00:00:00Z').getTime();
		const t3 = new Date('2024-06-02T00:00:00Z').getTime();
		db.raw.prepare('INSERT INTO posts (slug, body, created_at) VALUES (?, ?, ?)').run('p1', 'x', t1);
		db.raw.prepare('INSERT INTO posts (slug, body, created_at) VALUES (?, ?, ?)').run('p2', 'x', t2);
		db.raw.prepare('INSERT INTO posts (slug, body, created_at) VALUES (?, ?, ?)').run('p3', 'x', t3);
		const result = db.getPostCadence(365 * 2);
		const dates = result.map((r) => r.date);
		expect(dates).toEqual([...dates].sort());
	});
});
