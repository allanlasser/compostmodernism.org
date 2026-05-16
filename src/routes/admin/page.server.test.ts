import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Post } from '$lib/db';

vi.mock('$env/dynamic/private', () => ({
	env: { POST_SECRET: 'test-secret' }
}));
vi.mock('$lib/db', () => ({ getPosts: vi.fn() }));

import { load } from './+page.server';
import { getPosts } from '$lib/db';

const mockGetPosts = vi.mocked(getPosts);

function makePost(over: Partial<Post> = {}): Post {
	const created_at = Date.UTC(2026, 0, 15, 12, 0, 0);
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

function makeEvent(cookieValue?: string, search = '') {
	return {
		cookies: { get: vi.fn().mockReturnValue(cookieValue) },
		url: new URL(`http://localhost/admin${search}`)
	};
}

beforeEach(() => {
	mockGetPosts.mockReset();
});

describe('admin loader', () => {
	it('missing session cookie → redirect to /admin?auth=required', async () => {
		await expect(load(makeEvent(undefined) as never)).rejects.toMatchObject({
			status: 303,
			location: '/admin?auth=required'
		});
	});

	it('wrong session value → redirect', async () => {
		await expect(load(makeEvent('not-the-secret') as never)).rejects.toMatchObject({
			status: 303,
			location: '/admin?auth=required'
		});
	});

	it('?auth=required without session → returns empty data (no redirect, breaks loop)', async () => {
		const result = await load(makeEvent(undefined, '?auth=required') as never);
		expect(result).toEqual({});
	});

	it('correct session → returns { posts } with permalinks', async () => {
		mockGetPosts.mockReturnValue([makePost()]);
		const result = (await load(makeEvent('test-secret') as never)) as {
			posts: { slug: string; permalink: string }[];
		};
		expect(result.posts).toHaveLength(1);
		expect(result.posts[0].permalink).toBe('/2026/01/15/hello');
	});

	it('correct session → requests up to 100 posts (admin views more than feed)', async () => {
		mockGetPosts.mockReturnValue([]);
		await load(makeEvent('test-secret') as never);
		expect(mockGetPosts).toHaveBeenCalledWith({ limit: 100 });
	});
});
