import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Post } from '$lib/db';

vi.mock('$lib/db', () => ({ getPosts: vi.fn() }));
vi.mock('$env/dynamic/private', () => ({ env: { SITE_URL: 'https://compostmodernism.org' } }));

import { GET, _buildFeed as buildFeed } from './+server';
import { getPosts } from '$lib/db';

const mockGetPosts = vi.mocked(getPosts);

function makePost(over: Partial<Post> = {}): Post {
	const created_at = over.created_at ?? Date.UTC(2026, 0, 15, 12, 0, 0);
	return {
		id: 1,
		slug: 'hello-world',
		body: 'Hello **world**.',
		title: 'Hello World',
		url: null,
		created_at,
		type: 'post',
		date: created_at,
		tags: [],
		...over
	};
}

beforeEach(() => {
	mockGetPosts.mockReset();
	mockGetPosts.mockReturnValue([]);
});

describe('GET /feeds/posts.xml', () => {
	it('responds 200 with application/rss+xml', async () => {
		const setHeaders = vi.fn();
		const res = await GET({ setHeaders } as never);
		expect(res.status).toBe(200);
		expect(setHeaders).toHaveBeenCalledWith(
			expect.objectContaining({ 'Content-Type': 'application/rss+xml; charset=utf-8' })
		);
	});

	it('emits an RSS 2.0 channel skeleton', async () => {
		const setHeaders = vi.fn();
		const res = await GET({ setHeaders } as never);
		const xml = await res.text();
		expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
		expect(xml).toContain('<rss');
		expect(xml).toContain('<channel>');
		expect(xml).toContain('<title>');
	});
});

describe('buildFeed — post-type rendering', () => {
	const SITE = 'https://compostmodernism.org';

	it('link post: <link> is external URL, <guid> is permalink', () => {
		const post = makePost({
			slug: 'tasty-link',
			title: 'A tasty link',
			url: 'https://example.com/article'
		});
		const xml = buildFeed([post], SITE);
		expect(xml).toContain('<link>https://example.com/article</link>');
		expect(xml).toMatch(/<guid[^>]*>https:\/\/compostmodernism\.org\/2026\/01\/15\/tasty-link<\/guid>/);
	});

	it('titled post: <link> and <guid> are both the permalink', () => {
		const post = makePost({ slug: 'titled', title: 'Just a title', url: null });
		const xml = buildFeed([post], SITE);
		expect(xml).toContain('<link>https://compostmodernism.org/2026/01/15/titled</link>');
		expect(xml).toMatch(/<guid[^>]*>https:\/\/compostmodernism\.org\/2026\/01\/15\/titled<\/guid>/);
	});

	it('plain post (no title): falls back to a date-derived title, permalink used for link + guid', () => {
		const post = makePost({ slug: '8charhex', title: null, url: null });
		const xml = buildFeed([post], SITE);
		expect(xml).toContain('<link>https://compostmodernism.org/2026/01/15/8charhex</link>');
		expect(xml).toMatch(/<guid[^>]*>https:\/\/compostmodernism\.org\/2026\/01\/15\/8charhex<\/guid>/);
		expect(xml).toMatch(/<title>.*2026.*<\/title>/);
	});

	it('renders full-text content as HTML in content:encoded', () => {
		const post = makePost({ body: 'Hello **world**.' });
		const xml = buildFeed([post], SITE);
		expect(xml).toContain('<content:encoded>');
		expect(xml).toContain('<strong>world</strong>');
	});

	it('emits items in the order provided (newest first)', () => {
		const newer = makePost({ slug: 'newer', title: 'Newer', created_at: Date.UTC(2026, 4, 1) });
		const older = makePost({ slug: 'older', title: 'Older', created_at: Date.UTC(2026, 3, 1) });
		const xml = buildFeed([newer, older], SITE);
		const iNewer = xml.indexOf('Newer');
		const iOlder = xml.indexOf('Older');
		expect(iNewer).toBeGreaterThan(-1);
		expect(iOlder).toBeGreaterThan(iNewer);
	});

	it('strips a trailing slash from the site URL when building absolute URLs', () => {
		const post = makePost({ slug: 'trail', title: 'T' });
		const xml = buildFeed([post], 'https://compostmodernism.org/');
		expect(xml).toContain('<link>https://compostmodernism.org/2026/01/15/trail</link>');
		expect(xml).not.toContain('compostmodernism.org//');
	});

	it('includes tags as <category> elements', () => {
		const post = makePost({
			slug: 'tagged',
			title: 'Tagged',
			tags: [{ name: 'Notes', slug: 'notes' }]
		});
		const xml = buildFeed([post], SITE);
		expect(xml).toMatch(/<category[^>]*>.*Notes.*<\/category>/);
	});

	it('handles an empty post list (no items, valid channel)', () => {
		const xml = buildFeed([], SITE);
		expect(xml).toContain('<channel>');
		expect(xml).not.toContain('<item>');
	});
});
