import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Post } from '$lib/db';

vi.mock('$lib/db', () => ({ getPostBySlug: vi.fn() }));

import { load } from './+page.server';
import { getPostBySlug } from '$lib/db';

const mockGet = vi.mocked(getPostBySlug);

function makePost(over: Partial<Post> = {}): Post {
	const created_at = Date.UTC(2026, 0, 15);
	return {
		id: 1,
		slug: 'hello',
		body: 'b',
		title: 'Hello',
		url: null,
		created_at,
		type: 'post',
		date: created_at,
		tags: [],
		...over
	};
}

beforeEach(() => {
	mockGet.mockReset();
});

describe('admin edit-post loader', () => {
	it('returns the post with permalink when slug is found', async () => {
		mockGet.mockReturnValue(makePost());
		const result = (await load({ params: { slug: 'hello' } } as never)) as {
			post: { slug: string; permalink: string };
		};
		expect(result.post.slug).toBe('hello');
		expect(result.post.permalink).toBe('/2026/01/15/hello');
	});

	it('throws 404 when slug is missing', async () => {
		mockGet.mockReturnValue(null);
		await expect(load({ params: { slug: 'nope' } } as never)).rejects.toMatchObject({
			status: 404
		});
	});
});
