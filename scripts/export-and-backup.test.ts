import { describe, expect, it, vi } from 'vitest';
import AdmZip from 'adm-zip';
import {
	SITE_ORIGIN,
	archiveEntryPath,
	archiveFilename,
	buildArchive,
	r2Key,
	renderFrontmatter,
	uploadBackup
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

describe('archiveEntryPath', () => {
	it('uses posts/YYYY/MM/DD/slug.md (forward slashes, zip-internal)', () => {
		expect(archiveEntryPath(post({ slug: 'hello-world' }))).toBe(
			'posts/2024/07/01/hello-world.md'
		);
	});

	it('zero-pads single-digit month and day', () => {
		expect(archiveEntryPath(post({ created_at: Date.UTC(2024, 0, 5, 12) }))).toBe(
			'posts/2024/01/05/hello-world.md'
		);
	});
});

describe('buildArchive', () => {
	const dbBytes = Buffer.from('SQLite format 3\0fake-db-bytes');

	it('includes a posts.db entry with the given bytes', () => {
		const zipBuf = buildArchive([], dbBytes);
		const entry = new AdmZip(zipBuf).getEntry('posts.db');
		expect(entry).not.toBeNull();
		expect(entry!.getData().equals(dbBytes)).toBe(true);
	});

	it('emits one entry per post under posts/YYYY/MM/DD/slug.md with rendered frontmatter', () => {
		const zipBuf = buildArchive([post()], dbBytes);
		const zip = new AdmZip(zipBuf);
		const entry = zip.getEntry('posts/2024/07/01/hello-world.md');
		expect(entry).not.toBeNull();
		const body = entry!.getData().toString('utf8');
		expect(body).toContain('slug: hello-world');
		expect(body).toContain('Body text.');
	});

	it('emits multiple post entries when given multiple posts', () => {
		const second = post({ id: 2, slug: 'second', created_at: Date.UTC(2024, 6, 2, 12) });
		const zipBuf = buildArchive([post(), second], dbBytes);
		const zip = new AdmZip(zipBuf);
		expect(zip.getEntry('posts/2024/07/01/hello-world.md')).not.toBeNull();
		expect(zip.getEntry('posts/2024/07/02/second.md')).not.toBeNull();
	});

	it('with zero posts still emits posts.db (db-only snapshot)', () => {
		const zipBuf = buildArchive([], dbBytes);
		const zip = new AdmZip(zipBuf);
		const names = zip.getEntries().map((e) => e.entryName);
		expect(names).toEqual(['posts.db']);
	});
});

describe('archiveFilename', () => {
	it('formats YYYY-MM-DD.zip from a Date', () => {
		expect(archiveFilename(new Date('2024-07-01T12:34:56Z'))).toBe('2024-07-01.zip');
	});

	it('uses UTC date components', () => {
		expect(archiveFilename(new Date('2024-07-01T23:30:00-05:00'))).toBe('2024-07-02.zip');
	});
});

describe('r2Key', () => {
	it('returns backups/YYYY-MM-DD.zip — same basename as on disk', () => {
		expect(r2Key(new Date('2024-07-01T12:00:00Z'))).toBe('backups/2024-07-01.zip');
	});
});

describe('uploadBackup', () => {
	it('sends a PutObjectCommand with bucket, key, body, and application/zip', async () => {
		const send = vi.fn().mockResolvedValue({});
		const buffer = Buffer.from('PK\x03\x04zip-bytes');
		await uploadBackup(
			{ send } as unknown as Parameters<typeof uploadBackup>[0],
			'compostmodernism',
			buffer,
			'backups/2024-07-01.zip'
		);
		expect(send).toHaveBeenCalledOnce();
		const cmd = send.mock.calls[0][0];
		expect(cmd.input.Bucket).toBe('compostmodernism');
		expect(cmd.input.Key).toBe('backups/2024-07-01.zip');
		expect(cmd.input.Body).toBe(buffer);
		expect(cmd.input.ContentType).toBe('application/zip');
	});
});
