import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Post } from '$lib/db';

vi.mock('$lib/db', () => ({ getPosts: vi.fn(), countPosts: vi.fn() }));

import { GET } from './+server';
import { getPosts, countPosts } from '$lib/db';

const mockGetPosts = vi.mocked(getPosts);
const mockCount = vi.mocked(countPosts);

function makePost(slug: string, over: Partial<Post> = {}): Post {
	const created_at = Date.UTC(2024, 0, 15, 12);
	return {
		id: 1,
		slug,
		body: 'b',
		title: null,
		url: null,
		created_at,
		draft: 0,
		type: 'post',
		date: created_at,
		tags: [],
		place_id: null,
		place: null,
		...over
	};
}

function call(search = '') {
	return GET({ url: new URL(`http://localhost/api/feed${search}`) } as never);
}

beforeEach(() => {
	mockGetPosts.mockReset();
	mockCount.mockReset();
});

describe('GET /api/feed', () => {
	it('returns posts with permalinks and the next offset', async () => {
		mockGetPosts.mockReturnValue([makePost('a'), makePost('b')]);
		mockCount.mockReturnValue(100);
		const res = await call('?offset=50&limit=2');
		expect(res.status).toBe(200);
		expect(mockGetPosts).toHaveBeenCalledWith({ limit: 2, offset: 50 });
		const body = await res.json();
		expect(body.posts.map((p: { slug: string }) => p.slug)).toEqual(['a', 'b']);
		expect(body.posts[0].permalink).toBe('/2024/01/15/a');
		expect(body.nextOffset).toBe(52);
	});

	it('defaults to offset 0 and a page of 25', async () => {
		mockGetPosts.mockReturnValue([]);
		mockCount.mockReturnValue(0);
		await call();
		expect(mockGetPosts).toHaveBeenCalledWith({ limit: 25, offset: 0 });
	});

	it('nextOffset is null on the last page', async () => {
		mockGetPosts.mockReturnValue([makePost('a'), makePost('b')]);
		mockCount.mockReturnValue(52);
		const body = await (await call('?offset=50')).json();
		expect(body.nextOffset).toBeNull();
	});

	it('400 with { error } on invalid query', async () => {
		const res = await call('?offset=-5');
		expect(res.status).toBe(400);
		expect(await res.json()).toHaveProperty('error');
		expect(mockGetPosts).not.toHaveBeenCalled();
	});
});
