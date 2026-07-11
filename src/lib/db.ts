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
	draft: number;
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
	slug?: string;
	created_at?: number;
	draft?: number;
}

export interface PostUpdate {
	body: string;
	title?: string | null;
	url?: string | null;
	tags?: string[];
	slug?: string;
	created_at?: number;
	draft?: number;
}

export interface OldPath {
	year: number;
	month: number;
	day: number;
	slug: string;
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

export interface ImageWithUsage extends ImageRow {
	usage_count: number;
}

export interface ImageMetadataUpdate {
	title?: string | null;
	alt?: string | null;
	caption?: string | null;
	credit?: string | null;
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

	function getImages({ limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}): ImageWithUsage[] {
		return raw
			.prepare(
				`SELECT i.*, COALESCE(u.n, 0) AS usage_count
				 FROM images i
				 LEFT JOIN (
				   SELECT image_id, COUNT(*) AS n FROM post_images GROUP BY image_id
				 ) u ON u.image_id = i.id
				 ORDER BY i.uploaded_at DESC, i.id DESC
				 LIMIT ? OFFSET ?`
			)
			.all(limit, offset) as ImageWithUsage[];
	}

	function countImages(): number {
		const row = raw.prepare('SELECT COUNT(*) AS n FROM images').get() as { n: number };
		return row.n;
	}

	function getImageById(id: number): ImageRow | null {
		const row = raw.prepare('SELECT * FROM images WHERE id = ?').get(id) as ImageRow | undefined;
		return row ?? null;
	}

	function getPostsForImage(imageId: number): { slug: string; title: string | null }[] {
		return raw
			.prepare(
				`SELECT p.slug, p.title
				 FROM posts p
				 JOIN post_images pi ON pi.post_id = p.id
				 WHERE pi.image_id = ?
				 ORDER BY p.created_at DESC, p.id DESC`
			)
			.all(imageId) as { slug: string; title: string | null }[];
	}

	function updateImage(id: number, metadata: ImageMetadataUpdate): void {
		const fields: string[] = [];
		const values: unknown[] = [];
		for (const key of ['title', 'alt', 'caption', 'credit'] as const) {
			if (metadata[key] !== undefined) {
				fields.push(`${key} = ?`);
				values.push(metadata[key]);
			}
		}
		if (!fields.length) return;
		values.push(id);
		raw.prepare(`UPDATE images SET ${fields.join(', ')} WHERE id = ?`).run(...values);
	}

	function touchImage(id: number): void {
		raw.prepare('UPDATE images SET uploaded_at = ? WHERE id = ?').run(Date.now(), id);
	}

	function deleteImage(id: number): { key: string } | null {
		const row = raw.prepare('SELECT key FROM images WHERE id = ?').get(id) as
			| { key: string }
			| undefined;
		if (!row) return null;
		raw.prepare('DELETE FROM images WHERE id = ?').run(id);
		return { key: row.key };
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
		const ts = input.created_at ?? Date.now();
		const slug = input.slug
			? input.slug
			: uniqueSlug(input.title ? slugify(input.title) : hashSlug(ts));
		const result = raw
			.prepare(
				`INSERT INTO posts (slug, body, title, url, created_at, draft)
				 VALUES (?, ?, ?, ?, ?, ?)`
			)
			.run(slug, input.body, input.title ?? null, input.url ?? null, ts, input.draft ?? 0);
		const id = Number(result.lastInsertRowid);
		setPostTags(id, input.tags ?? []);
		setPostImages(id, input.body);
		return { id, slug };
	}

	function getPosts({ limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}): Post[] {
		const rows = raw
			.prepare('SELECT * FROM posts WHERE draft = 0 ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?')
			.all(limit, offset) as PostRow[];
		return rows.map(hydrate);
	}

	function getDraftPosts({ limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}): Post[] {
		const rows = raw
			.prepare('SELECT * FROM posts WHERE draft = 1 ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?')
			.all(limit, offset) as PostRow[];
		return rows.map(hydrate);
	}

	function countPosts(): number {
		const row = raw.prepare('SELECT COUNT(*) AS n FROM posts WHERE draft = 0').get() as { n: number };
		return row.n;
	}

	function getPostBySlug(slug: string): Post | null {
		const row = raw.prepare('SELECT * FROM posts WHERE slug = ?').get(slug) as
			| PostRow
			| undefined;
		return row ? hydrate(row) : null;
	}

	function getPostById(id: number): Post | null {
		const row = raw.prepare('SELECT * FROM posts WHERE id = ?').get(id) as
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

	function slugTaken(slug: string): boolean {
		return raw.prepare('SELECT 1 FROM posts WHERE slug = ?').get(slug) !== undefined;
	}

	function recordSlugRedirect(oldPath: OldPath, postId: number): void {
		raw.prepare(
			`INSERT INTO slug_redirects (old_year, old_month, old_day, old_slug, post_id)
			 VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT (old_year, old_month, old_day, old_slug)
			 DO UPDATE SET post_id = excluded.post_id`
		).run(oldPath.year, oldPath.month, oldPath.day, oldPath.slug, postId);
	}

	function getPostByOldPath(oldPath: OldPath): Post | null {
		const row = raw
			.prepare(
				`SELECT p.* FROM posts p
				 JOIN slug_redirects r ON r.post_id = p.id
				 WHERE r.old_year = ? AND r.old_month = ? AND r.old_day = ? AND r.old_slug = ?`
			)
			.get(oldPath.year, oldPath.month, oldPath.day, oldPath.slug) as PostRow | undefined;
		return row ? hydrate(row) : null;
	}

	function recordShortlinkRedirect(token: string, postId: number): void {
		raw.prepare(
			`INSERT INTO shortlink_redirects (old_token, post_id)
			 VALUES (?, ?)
			 ON CONFLICT (old_token) DO NOTHING`
		).run(token, postId);
	}

	function getPostByOldToken(token: string): Post | null {
		const row = raw
			.prepare(
				`SELECT p.* FROM posts p
				 JOIN shortlink_redirects r ON r.post_id = p.id
				 WHERE r.old_token = ?`
			)
			.get(token) as PostRow | undefined;
		return row ? hydrate(row) : null;
	}

	function getPostCadence(): { date: string; count: number }[] {
		return raw
			.prepare(
				`SELECT date(created_at / 1000, 'unixepoch') as date, COUNT(*) as count
				 FROM posts
				 GROUP BY date
				 ORDER BY date`
			)
			.all() as { date: string; count: number }[];
	}

	function updatePost(slug: string, update: PostUpdate): void {
		const existing = raw
			.prepare('SELECT id, slug, created_at, draft FROM posts WHERE slug = ?')
			.get(slug) as { id: number; slug: string; created_at: number; draft: number } | undefined;
		if (!existing) return;

		const newSlug = update.slug ?? existing.slug;
		const newCreatedAt = update.created_at ?? existing.created_at;
		const pathChanged = newSlug !== existing.slug || newCreatedAt !== existing.created_at;

		if (pathChanged) {
			const oldDate = new Date(existing.created_at);
			recordSlugRedirect(
				{
					year: oldDate.getUTCFullYear(),
					month: oldDate.getUTCMonth() + 1,
					day: oldDate.getUTCDate(),
					slug: existing.slug
				},
				existing.id
			);
		}

		raw.prepare(
			'UPDATE posts SET body = ?, title = ?, url = ?, slug = ?, created_at = ?, draft = ? WHERE id = ?'
		).run(
			update.body,
			update.title ?? null,
			update.url ?? null,
			newSlug,
			newCreatedAt,
			update.draft ?? existing.draft,
			existing.id
		);

		if (Array.isArray(update.tags)) setPostTags(existing.id, update.tags);
		setPostImages(existing.id, update.body);
	}

	function deletePost(slug: string): void {
		raw.prepare('DELETE FROM posts WHERE slug = ?').run(slug);
	}

	return {
		raw,
		insertPost,
		getPosts,
		getDraftPosts,
		countPosts,
		getPostBySlug,
		getPostById,
		getPostsByTag,
		getAllTags,
		getPostCadence,
		updatePost,
		deletePost,
		slugTaken,
		getPostByOldPath,
		recordShortlinkRedirect,
		getPostByOldToken,
		recordImage,
		getImages,
		countImages,
		getImageById,
		getPostsForImage,
		updateImage,
		touchImage,
		deleteImage,
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
export const getDraftPosts: Db['getDraftPosts'] = (opts) => defaultDb().getDraftPosts(opts);
export const countPosts: Db['countPosts'] = () => defaultDb().countPosts();
export const getPostBySlug: Db['getPostBySlug'] = (slug) => defaultDb().getPostBySlug(slug);
export const getPostById: Db['getPostById'] = (id) => defaultDb().getPostById(id);
export const getPostsByTag: Db['getPostsByTag'] = (slug, opts) =>
	defaultDb().getPostsByTag(slug, opts);
export const getAllTags: Db['getAllTags'] = () => defaultDb().getAllTags();
export const updatePost: Db['updatePost'] = (slug, update) =>
	defaultDb().updatePost(slug, update);
export const deletePost: Db['deletePost'] = (slug) => defaultDb().deletePost(slug);
export const slugTaken: Db['slugTaken'] = (slug) => defaultDb().slugTaken(slug);
export const getPostByOldPath: Db['getPostByOldPath'] = (oldPath) =>
	defaultDb().getPostByOldPath(oldPath);
export const recordShortlinkRedirect: Db['recordShortlinkRedirect'] = (token, postId) =>
	defaultDb().recordShortlinkRedirect(token, postId);
export const getPostByOldToken: Db['getPostByOldToken'] = (token) =>
	defaultDb().getPostByOldToken(token);
export const recordImage: Db['recordImage'] = (key) => defaultDb().recordImage(key);
export const getImages: Db['getImages'] = (opts) => defaultDb().getImages(opts);
export const countImages: Db['countImages'] = () => defaultDb().countImages();
export const getImageById: Db['getImageById'] = (id) => defaultDb().getImageById(id);
export const getPostsForImage: Db['getPostsForImage'] = (id) => defaultDb().getPostsForImage(id);
export const updateImage: Db['updateImage'] = (id, metadata) =>
	defaultDb().updateImage(id, metadata);
export const touchImage: Db['touchImage'] = (id) => defaultDb().touchImage(id);
export const deleteImage: Db['deleteImage'] = (id) => defaultDb().deleteImage(id);
export const setPostImages: Db['setPostImages'] = (postId, body) =>
	defaultDb().setPostImages(postId, body);
export const getPostCadence: Db['getPostCadence'] = () => defaultDb().getPostCadence();
