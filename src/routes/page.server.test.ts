import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Post } from '$lib/db';

vi.mock('$lib/db', () => ({ getPosts: vi.fn() }));

import { load } from './+page.server';
import { getPosts } from '$lib/db';

const mockGetPosts = vi.mocked(getPosts);

function makePost(over: Partial<Post> = {}): Post {
	const created_at = over.created_at ?? Date.UTC(2026, 0, 15, 12, 0, 0);
	return {
		id: 1,
		slug: 'hello-world',
		body: 'b',
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
});

describe('feed loader', () => {
	it('returns { feed } with permalink on each post', async () => {
		mockGetPosts.mockReturnValue([makePost()]);
		const result = (await load({} as never)) as { feed: { slug: string; permalink: string }[] };
		expect(result.feed[0].permalink).toBe('/2026/01/15/hello-world');
	});

	it('preserves order from getPosts (reverse chronological)', async () => {
		mockGetPosts.mockReturnValue([
			makePost({ slug: 'newest', created_at: Date.UTC(2026, 4, 1) }),
			makePost({ slug: 'older', created_at: Date.UTC(2026, 3, 1) })
		]);
		const result = (await load({} as never)) as { feed: { slug: string; permalink: string }[] };
		expect(result.feed.map((p: { slug: string }) => p.slug)).toEqual(['newest', 'older']);
	});
});
