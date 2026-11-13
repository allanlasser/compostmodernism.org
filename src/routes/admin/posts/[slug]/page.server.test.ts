import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Post } from '$lib/db';

vi.mock('$lib/db', () => ({
	getPostBySlug: vi.fn(),
	getPlaceNames: vi.fn(() => []),
	getPostLocation: vi.fn(() => null)
}));

import { load } from './+page.server';
import { getPostBySlug, getPlaceNames, getPostLocation } from '$lib/db';

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
		draft: 0,
		type: 'post',
		date: created_at,
		tags: [],
		place: null,
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

	it('looks the post up with drafts included', async () => {
		mockGet.mockReturnValue(makePost({ draft: 1 }));
		await load({ params: { slug: 'hello' } } as never);
		expect(mockGet).toHaveBeenCalledWith('hello', { includeDrafts: true });
	});

	it('throws 404 when slug is missing', async () => {
		mockGet.mockReturnValue(null);
		await expect(load({ params: { slug: 'nope' } } as never)).rejects.toMatchObject({
			status: 404
		});
	});

	it('returns the post location and known place names', async () => {
		const home = { name: 'Home', slug: 'home', latitude: 1, longitude: 2, count: 3 };
		const here = { name: 'Home', slug: 'home', latitude: 1.1, longitude: 2.1 };
		vi.mocked(getPlaceNames).mockReturnValue([home]);
		vi.mocked(getPostLocation).mockReturnValue(here);
		mockGet.mockReturnValue(makePost());
		const result = (await load({ params: { slug: 'hello' } } as never)) as {
			places: unknown[];
			location: unknown;
		};
		expect(vi.mocked(getPostLocation)).toHaveBeenCalledWith(1);
		expect(result.places).toEqual([home]);
		expect(result.location).toEqual(here);
	});
});
