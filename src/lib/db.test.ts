import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from './db';

type Db = ReturnType<typeof createDb>;
let db: Db;

beforeEach(() => {
	db = createDb(':memory:');
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
