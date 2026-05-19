import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Post } from '$lib/db';

vi.mock('$env/dynamic/private', () => ({
	env: { POST_SECRET: 'test-secret' }
}));
vi.mock('$lib/db', () => ({
	getPosts: vi.fn(),
	countPosts: vi.fn()
}));

import { load, _PER_PAGE } from './+page.server';
import { getPosts, countPosts } from '$lib/db';

const mockGetPosts = vi.mocked(getPosts);
const mockCountPosts = vi.mocked(countPosts);

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

function makeEvent(search = '') {
	return { url: new URL(`http://localhost/admin/posts${search}`) };
}

beforeEach(() => {
	mockGetPosts.mockReset();
	mockCountPosts.mockReset();
});

describe('admin posts loader', () => {
	it('loads page 1 by default with _PER_PAGE limit and offset 0', async () => {
		mockGetPosts.mockReturnValue([makePost()]);
		mockCountPosts.mockReturnValue(7);
		const result = (await load(makeEvent() as never)) as {
			posts: { slug: string; permalink: string }[];
			page: number;
			perPage: number;
			total: number;
			totalPages: number;
		};
		expect(mockGetPosts).toHaveBeenCalledWith({ limit: _PER_PAGE, offset: 0 });
		expect(result.page).toBe(1);
		expect(result.perPage).toBe(_PER_PAGE);
		expect(result.total).toBe(7);
		expect(result.totalPages).toBe(1);
		expect(result.posts[0].permalink).toBe('/2026/01/15/hello');
	});

	it('passes offset for ?page=3', async () => {
		mockGetPosts.mockReturnValue([]);
		mockCountPosts.mockReturnValue(80);
		const result = (await load(makeEvent('?page=3') as never)) as { page: number; totalPages: number };
		expect(mockGetPosts).toHaveBeenCalledWith({ limit: _PER_PAGE, offset: _PER_PAGE * 2 });
		expect(result.page).toBe(3);
		expect(result.totalPages).toBe(Math.ceil(80 / _PER_PAGE));
	});

	it('clamps page=0 or negative to page 1', async () => {
		mockGetPosts.mockReturnValue([]);
		mockCountPosts.mockReturnValue(0);
		const result = (await load(makeEvent('?page=0') as never)) as { page: number };
		expect(result.page).toBe(1);
		expect(mockGetPosts).toHaveBeenCalledWith({ limit: _PER_PAGE, offset: 0 });
	});

	it('clamps page beyond totalPages to totalPages', async () => {
		mockGetPosts.mockReturnValue([]);
		mockCountPosts.mockReturnValue(3);
		const result = (await load(makeEvent('?page=99') as never)) as { page: number };
		// total=3, perPage=_PER_PAGE → totalPages=1, so page clamps to 1.
		expect(result.page).toBe(1);
	});
});
