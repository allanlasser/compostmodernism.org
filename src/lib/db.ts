import { join } from 'node:path';
import Database from 'better-sqlite3';
import { slugify } from './slug';
import { hashSlug } from './hash';
import { migrate } from './migrate';

// db.ts is shared between the SvelteKit server and CLI scripts (init-db, seed,
// export-and-backup). The SvelteKit-only `$env/dynamic/private` virtual module
// can't be resolved by tsx, so read process.env directly here.

export interface Tag {
	name: string;
	slug: string;
}

export interface TagWithCount extends Tag {
	count: number;
}

export interface PostRow {
	id: number;
	slug: string;
	body: string;
	title: string | null;
	url: string | null;
	created_at: number;
}

export interface Post extends PostRow {
	type: 'post';
	date: number;
	tags: Tag[];
}

export interface PostInput {
	body: string;
	title?: string | null;
	url?: string | null;
	tags?: string[];
}

export interface PostUpdate {
	body: string;
	title?: string | null;
	url?: string | null;
	tags?: string[];
}

export interface InsertResult {
	id: number;
	slug: string;
}

export interface ImageRow {
	id: number;
	key: string;
	uploaded_at: number;
	title: string | null;
	alt: string | null;
	caption: string | null;
	credit: string | null;
}

export function createDb(path: string) {
	const raw = new Database(path);
	if (path !== ':memory:') raw.pragma('journal_mode = WAL');
	raw.pragma('foreign_keys = ON');
	migrate(raw);

	function uniqueSlug(candidate: string): string {
		const exists = raw.prepare('SELECT 1 FROM posts WHERE slug = ?');
		let slug = candidate;
		let suffix = 2;
		while (exists.get(slug)) slug = `${candidate}-${suffix++}`;
		return slug;
	}

	function resolveTagIds(tagNames: string[]): number[] {
		const find = raw.prepare('SELECT id FROM tags WHERE slug = ?');
		const insert = raw.prepare('INSERT INTO tags (name, slug) VALUES (?, ?)');
		return tagNames.map((name) => {
			const slug = slugify(name);
			const existing = find.get(slug) as { id: number } | undefined;
			if (existing) return existing.id;
			return Number(insert.run(name.trim(), slug).lastInsertRowid);
		});
	}

	function getTagsForPost(postId: number): Tag[] {
		return raw
			.prepare(
				`SELECT t.name, t.slug FROM tags t
				 JOIN post_tags pt ON pt.tag_id = t.id
				 WHERE pt.post_id = ?
				 ORDER BY t.name`
			)
			.all(postId) as Tag[];
	}

	function setPostTags(postId: number, tagNames: string[]): void {
		raw.prepare('DELETE FROM post_tags WHERE post_id = ?').run(postId);
		const tagIds = resolveTagIds(tagNames);
		const insert = raw.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)');
		for (const tagId of tagIds) insert.run(postId, tagId);
	}

	function hydrate(row: PostRow): Post {
		return { ...row, type: 'post', date: row.created_at, tags: getTagsForPost(row.id) };
	}

	function recordImage(key: string): ImageRow {
		const now = Date.now();
		raw.prepare('INSERT INTO images (key, uploaded_at) VALUES (?, ?) ON CONFLICT (key) DO NOTHING')
			.run(key, now);
		return raw.prepare('SELECT * FROM images WHERE key = ?').get(key) as ImageRow;
	}

	function extractImageKeys(body: string): Set<string> {
		const base = process.env.R2_PUBLIC_URL;
		const keys = new Set<string>();
		if (!base) return keys;
		const prefix = base.replace(/\/$/, '') + '/';
		const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const pattern = new RegExp(escaped + '(images/[^\\s)"\'<>]+\\.webp)', 'g');
		for (const match of body.matchAll(pattern)) keys.add(match[1]);
		return keys;
	}

	function setPostImages(postId: number, body: string): void {
		raw.prepare('DELETE FROM post_images WHERE post_id = ?').run(postId);
		const keys = extractImageKeys(body);
		if (!keys.size) return;
		const select = raw.prepare('SELECT id FROM images WHERE key = ?');
		const insert = raw.prepare(
			'INSERT OR IGNORE INTO post_images (post_id, image_id) VALUES (?, ?)'
		);
		for (const key of keys) {
			const row = select.get(key) as { id: number } | undefined;
			if (row) insert.run(postId, row.id);
		}
	}

	function insertPost(input: PostInput): InsertResult {
		const now = Date.now();
		const baseSlug = input.title ? slugify(input.title) : hashSlug(now);
		const slug = uniqueSlug(baseSlug);
		const result = raw
			.prepare(
				`INSERT INTO posts (slug, body, title, url, created_at)
				 VALUES (?, ?, ?, ?, ?)`
			)
			.run(slug, input.body, input.title ?? null, input.url ?? null, now);
		const id = Number(result.lastInsertRowid);
		setPostTags(id, input.tags ?? []);
		setPostImages(id, input.body);
		return { id, slug };
	}

	function getPosts({ limit = 50 }: { limit?: number } = {}): Post[] {
		const rows = raw
			.prepare('SELECT * FROM posts ORDER BY created_at DESC, id DESC LIMIT ?')
			.all(limit) as PostRow[];
		return rows.map(hydrate);
	}

	function getPostBySlug(slug: string): Post | null {
		const row = raw.prepare('SELECT * FROM posts WHERE slug = ?').get(slug) as
			| PostRow
			| undefined;
		return row ? hydrate(row) : null;
	}

	function getPostsByTag(
		tagSlug: string,
		{ limit = 50 }: { limit?: number } = {}
	): Post[] | null {
		const tagExists = raw.prepare('SELECT 1 FROM tags WHERE slug = ?').get(tagSlug);
		if (!tagExists) return null;
		const rows = raw
			.prepare(
				`SELECT p.* FROM posts p
				 JOIN post_tags pt ON pt.post_id = p.id
				 JOIN tags t       ON t.id      = pt.tag_id
				 WHERE t.slug = ?
				 ORDER BY p.created_at DESC, p.id DESC
				 LIMIT ?`
			)
			.all(tagSlug, limit) as PostRow[];
		return rows.map(hydrate);
	}

	function getAllTags(): TagWithCount[] {
		return raw
			.prepare(
				`SELECT t.name, t.slug, COUNT(pt.post_id) AS count
				 FROM tags t
				 JOIN post_tags pt ON pt.tag_id = t.id
				 GROUP BY t.id
				 ORDER BY count DESC, t.name ASC`
			)
			.all() as TagWithCount[];
	}

	function updatePost(slug: string, update: PostUpdate): void {
		raw.prepare(
			'UPDATE posts SET body = ?, title = ?, url = ? WHERE slug = ?'
		).run(update.body, update.title ?? null, update.url ?? null, slug);

		const post = raw.prepare('SELECT id FROM posts WHERE slug = ?').get(slug) as
			| { id: number }
			| undefined;
		if (!post) return;
		if (Array.isArray(update.tags)) setPostTags(post.id, update.tags);
		setPostImages(post.id, update.body);
	}

	function deletePost(slug: string): void {
		raw.prepare('DELETE FROM posts WHERE slug = ?').run(slug);
	}

	return {
		raw,
		insertPost,
		getPosts,
		getPostBySlug,
		getPostsByTag,
		getAllTags,
		updatePost,
		deletePost,
		recordImage,
		setPostImages
	};
}

export type Db = ReturnType<typeof createDb>;

let _default: Db | null = null;
function defaultDb(): Db {
	if (!_default) _default = createDb(join(process.cwd(), 'posts.db'));
	return _default;
}

export const insertPost: Db['insertPost'] = (input) => defaultDb().insertPost(input);
export const getPosts: Db['getPosts'] = (opts) => defaultDb().getPosts(opts);
export const getPostBySlug: Db['getPostBySlug'] = (slug) => defaultDb().getPostBySlug(slug);
export const getPostsByTag: Db['getPostsByTag'] = (slug, opts) =>
	defaultDb().getPostsByTag(slug, opts);
export const getAllTags: Db['getAllTags'] = () => defaultDb().getAllTags();
export const updatePost: Db['updatePost'] = (slug, update) =>
	defaultDb().updatePost(slug, update);
export const deletePost: Db['deletePost'] = (slug) => defaultDb().deletePost(slug);
export const recordImage: Db['recordImage'] = (key) => defaultDb().recordImage(key);
export const setPostImages: Db['setPostImages'] = (postId, body) =>
	defaultDb().setPostImages(postId, body);
