import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	SITE_ORIGIN,
	archivePath,
	backupDatabase,
	backupKey,
	exportPosts,
	renderFrontmatter
} from './export-and-backup';
import type { Post } from '../src/lib/db';

function post(overrides: Partial<Post> = {}): Post {
	return {
		id: 1,
		slug: 'hello-world',
		body: 'Body text.',
		title: 'Hello, World',
		url: null,
		created_at: Date.UTC(2024, 6, 1, 12, 0, 0),
		type: 'post',
		date: Date.UTC(2024, 6, 1, 12, 0, 0),
		tags: [],
		...overrides
	};
}

describe('renderFrontmatter', () => {
	it('renders id, slug, created_at, and absolute permalink', () => {
		const md = renderFrontmatter(post());
		expect(md).toMatch(/^---\n/);
		expect(md).toContain('id: 1');
		expect(md).toContain('slug: hello-world');
		expect(md).toContain('created_at: 2024-07-01T12:00:00.000Z');
		expect(md).toContain(`permalink: ${SITE_ORIGIN}/2024/07/01/hello-world`);
	});

	it('omits title and url when absent', () => {
		const md = renderFrontmatter(post({ title: null, url: null }));
		expect(md).not.toMatch(/^title:/m);
		expect(md).not.toMatch(/^url:/m);
	});

	it('includes title and url when present', () => {
		const md = renderFrontmatter(post({ title: 'Hi', url: 'https://example.com/' }));
		expect(md).toMatch(/^title: "Hi"$/m);
		expect(md).toMatch(/^url: https:\/\/example\.com\/$/m);
	});

	it('JSON-escapes titles containing quotes', () => {
		const md = renderFrontmatter(post({ title: 'It "works"' }));
		expect(md).toContain('title: "It \\"works\\""');
	});

	it('renders tags as a YAML list when present', () => {
		const md = renderFrontmatter(
			post({
				tags: [
					{ name: 'meta', slug: 'meta' },
					{ name: 'food', slug: 'food' }
				]
			})
		);
		expect(md).toMatch(/^tags:\n  - meta\n  - food$/m);
	});

	it('omits the tags block when no tags', () => {
		const md = renderFrontmatter(post({ tags: [] }));
		expect(md).not.toContain('tags:');
	});

	it('terminates with the body followed by a trailing newline', () => {
		const md = renderFrontmatter(post({ body: 'first line\n\nsecond para' }));
		expect(md.endsWith('first line\n\nsecond para\n')).toBe(true);
	});
});

describe('archivePath', () => {
	it('uses archive/YYYY/MM/DD/slug.md', () => {
		expect(archivePath(post({ slug: 'hello-world' }))).toBe(
			join('archive', '2024', '07', '01', 'hello-world.md')
		);
	});

	it('zero-pads single-digit month and day', () => {
		expect(archivePath(post({ created_at: Date.UTC(2024, 0, 5, 12) }))).toBe(
			join('archive', '2024', '01', '05', 'hello-world.md')
		);
	});
});

describe('exportPosts', () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), 'cm-export-'));
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it('writes a file per post under the root directory', async () => {
		await exportPosts([post()], root);
		const target = join(root, 'archive/2024/07/01/hello-world.md');
		expect(existsSync(target)).toBe(true);
		expect(readFileSync(target, 'utf8')).toContain('slug: hello-world');
	});

	it('creates intermediate directories', async () => {
		await exportPosts([post({ created_at: Date.UTC(2099, 11, 31, 12) })], root);
		expect(existsSync(join(root, 'archive/2099/12/31/hello-world.md'))).toBe(true);
	});

	it('overwrites an existing file on re-run', async () => {
		await exportPosts([post({ body: 'original' })], root);
		await exportPosts([post({ body: 'updated' })], root);
		const target = join(root, 'archive/2024/07/01/hello-world.md');
		expect(readFileSync(target, 'utf8')).toContain('updated');
		expect(readFileSync(target, 'utf8')).not.toContain('original');
	});

	it('returns the count of posts written', async () => {
		const count = await exportPosts(
			[post(), post({ id: 2, slug: 'second', created_at: Date.UTC(2024, 6, 2, 12) })],
			root
		);
		expect(count).toBe(2);
	});

	it('does not touch unrelated files in the root', async () => {
		const sibling = join(root, 'unrelated.txt');
		writeFileSync(sibling, 'leave me alone', 'utf8');
		await exportPosts([post()], root);
		expect(readFileSync(sibling, 'utf8')).toBe('leave me alone');
	});
});

describe('backupKey', () => {
	it('formats backups/posts-YYYY-MM-DD.db from a Date', () => {
		expect(backupKey(new Date('2024-07-01T12:34:56Z'))).toBe('backups/posts-2024-07-01.db');
	});

	it('uses UTC date components', () => {
		// 23:30 in UTC-5 is still 04:30 UTC the next day — UTC wins.
		expect(backupKey(new Date('2024-07-01T23:30:00-05:00'))).toBe('backups/posts-2024-07-02.db');
	});
});

describe('backupDatabase', () => {
	it('sends a PutObjectCommand with bucket, key, body, and content type', async () => {
		const send = vi.fn().mockResolvedValue({});
		const buffer = Buffer.from('SQLite format 3\0');
		await backupDatabase(
			{ send } as unknown as Parameters<typeof backupDatabase>[0],
			'compostmodernism',
			buffer,
			'backups/posts-2024-07-01.db'
		);
		expect(send).toHaveBeenCalledOnce();
		const cmd = send.mock.calls[0][0];
		expect(cmd.input.Bucket).toBe('compostmodernism');
		expect(cmd.input.Key).toBe('backups/posts-2024-07-01.db');
		expect(cmd.input.Body).toBe(buffer);
		expect(cmd.input.ContentType).toBe('application/octet-stream');
	});
});
