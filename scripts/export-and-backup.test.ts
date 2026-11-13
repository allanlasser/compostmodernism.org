import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdmZip from 'adm-zip';
import {
	SITE_ORIGIN,
	archiveEntryPath,
	archiveFilename,
	buildArchive,
	pingHeartbeat,
	r2Key,
	renderFrontmatter,
	runWithHeartbeat,
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

const checkIn = 'https://o1.ingest.sentry.io/api/2/cron/nightly-backup/publickey/';

describe('pingHeartbeat', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	function stubFetch(impl: () => Promise<unknown> = async () => ({ ok: true, status: 200 })) {
		const fetchMock = vi.fn(impl);
		vi.stubGlobal('fetch', fetchMock);
		return fetchMock;
	}

	it('GETs the check-in URL with status=ok', async () => {
		const fetchMock = stubFetch();
		await pingHeartbeat(checkIn, 'ok');
		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([`${checkIn}?status=ok`]);
	});

	it('reports status=error', async () => {
		const fetchMock = stubFetch();
		await pingHeartbeat(checkIn, 'error');
		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([`${checkIn}?status=error`]);
	});

	it('keeps query parameters already on the URL', async () => {
		const fetchMock = stubFetch();
		await pingHeartbeat(`${checkIn}?environment=prod`, 'ok');
		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			`${checkIn}?environment=prod&status=ok`
		]);
	});

	it('warns instead of pinging when the URL is unset', async () => {
		const fetchMock = stubFetch();
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await pingHeartbeat(undefined, 'ok');
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('BACKUP_HEARTBEAT_URL'));
		expect(fetchMock.mock.calls).toEqual([]);
	});

	it('warns and resolves when the URL is malformed', async () => {
		stubFetch();
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await expect(pingHeartbeat('not a url', 'ok')).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('Heartbeat ping failed'));
	});

	it('warns and resolves when the request rejects', async () => {
		stubFetch(async () => {
			throw new Error('network down');
		});
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await expect(pingHeartbeat(checkIn, 'ok')).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('network down'));
	});

	it('warns and resolves on a non-2xx response', async () => {
		stubFetch(async () => ({ ok: false, status: 404 }));
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await expect(pingHeartbeat(checkIn, 'ok')).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('404'));
	});
});

describe('runWithHeartbeat', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	const url = checkIn;

	it('reports ok once, only after the job has finished', async () => {
		const events: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(async (u: string) => {
				events.push(`ping ${u}`);
				return { ok: true, status: 200 };
			})
		);
		await runWithHeartbeat(async () => {
			events.push('job done');
			return true;
		}, url);
		expect(events).toEqual(['job done', `ping ${url}?status=ok`]);
	});

	it('reports status=error and rethrows when the job throws', async () => {
		const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		await expect(
			runWithHeartbeat(async () => {
				throw new Error('upload failed');
			}, url)
		).rejects.toThrow('upload failed');
		expect(fetchMock.mock.calls.map(([u]) => u)).toEqual([`${url}?status=error`]);
	});

	it('does not report success when the R2 mirror was skipped', async () => {
		const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await runWithHeartbeat(async () => false, url);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('not mirrored'));
		expect(fetchMock.mock.calls).toEqual([]);
	});

	it('still completes when the ping itself fails', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('network down');
			})
		);
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		await expect(runWithHeartbeat(async () => true, url)).resolves.toBeUndefined();
	});
});

describe('production image dependencies', () => {
	it('lists adm-zip under dependencies, since the Dockerfile prunes devDependencies', () => {
		const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
		expect(Object.keys(pkg.dependencies)).toContain('adm-zip');
	});
});
