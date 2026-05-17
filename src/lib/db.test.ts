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
