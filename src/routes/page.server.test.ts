import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Post } from '$lib/db';

vi.mock('$lib/db', () => ({ getPosts: vi.fn(), countPosts: vi.fn() }));

import { load } from './+page.server';
import { getPosts, countPosts } from '$lib/db';

const mockGetPosts = vi.mocked(getPosts);
const mockCount = vi.mocked(countPosts);

function makePost(over: Partial<Post> = {}): Post {
	const created_at = over.created_at ?? Date.UTC(2026, 0, 15, 12, 0, 0);
	return {
		id: 1,
		slug: 'hello-world',
		body: 'b',
		title: 'Hello World',
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
	mockGetPosts.mockReset();
	mockCount.mockReset();
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

	it('nextOffset is the number of posts shown when more remain', async () => {
		mockGetPosts.mockReturnValue([makePost({ slug: 'a' }), makePost({ slug: 'b' })]);
		mockCount.mockReturnValue(120);
		const result = (await load({} as never)) as { nextOffset: number | null };
		expect(result.nextOffset).toBe(2);
	});

	it('nextOffset is null when the whole feed is already shown', async () => {
		mockGetPosts.mockReturnValue([makePost({ slug: 'a' }), makePost({ slug: 'b' })]);
		mockCount.mockReturnValue(2);
		const result = (await load({} as never)) as { nextOffset: number | null };
		expect(result.nextOffset).toBeNull();
	});

	it('asks for the newest 50 posts', async () => {
		mockGetPosts.mockReturnValue([]);
		mockCount.mockReturnValue(0);
		await load({} as never);
		expect(mockGetPosts).toHaveBeenCalledWith({ limit: 50 });
	});
});
