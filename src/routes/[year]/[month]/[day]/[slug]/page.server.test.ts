import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Post } from '$lib/db';

vi.mock('$lib/db', () => ({ getPostBySlug: vi.fn() }));

import { load } from './+page.server';
import { getPostBySlug } from '$lib/db';

const mockGet = vi.mocked(getPostBySlug);

const ts = Date.UTC(2026, 0, 15, 12, 0, 0); // 2026-01-15

function makePost(over: Partial<Post> = {}): Post {
	return {
		id: 1,
		slug: 'hello',
		body: 'body',
		title: 'Hello',
		url: null,
		created_at: ts,
		type: 'post',
		date: ts,
		tags: [],
		...over
	};
}

beforeEach(() => {
	mockGet.mockReset();
});

describe('single-post loader', () => {
	it('valid slug with correct date → returns post + permalink', async () => {
		mockGet.mockReturnValue(makePost());
		const result = await load({
			params: { year: '2026', month: '01', day: '15', slug: 'hello' }
		} as never);
		expect((result as { post: Post & { permalink: string } }).post.slug).toBe('hello');
		expect((result as { post: { permalink: string } }).post.permalink).toBe('/2026/01/15/hello');
	});

	it('unknown slug → throws 404', async () => {
		mockGet.mockReturnValue(null);
		await expect(
			load({ params: { year: '2026', month: '01', day: '15', slug: 'nope' } } as never)
		).rejects.toMatchObject({ status: 404 });
	});

	it('mismatched date parts → throws redirect to canonical URL', async () => {
		mockGet.mockReturnValue(makePost());
		await expect(
			load({ params: { year: '2025', month: '12', day: '31', slug: 'hello' } } as never)
		).rejects.toMatchObject({ status: 301, location: '/2026/01/15/hello' });
	});
});
