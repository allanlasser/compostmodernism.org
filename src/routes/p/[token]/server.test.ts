import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Post } from '$lib/db';
import { encodeId } from '$lib/shortid';

vi.mock('$lib/db', () => ({
	getPostById: vi.fn(),
	getPostByOldToken: vi.fn()
}));

import { GET } from './+server';
import { getPostById, getPostByOldToken } from '$lib/db';

const mockGetById = vi.mocked(getPostById);
const mockGetByOldToken = vi.mocked(getPostByOldToken);

const ts = Date.UTC(2026, 0, 15, 12, 0, 0); // 2026-01-15

function makePost(over: Partial<Post> = {}): Post {
	return {
		id: 42,
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
	mockGetById.mockReset();
	mockGetByOldToken.mockReset();
	mockGetByOldToken.mockReturnValue(null);
});

describe('GET /p/[token]', () => {
	it('valid current token → 301 to canonical permalink', async () => {
		mockGetById.mockReturnValue(makePost());
		const token = encodeId(42);
		await expect(GET({ params: { token } } as never)).rejects.toMatchObject({
			status: 301,
			location: '/2026/01/15/hello'
		});
		expect(mockGetById).toHaveBeenCalledWith(42);
	});

	it('garbage token that does not decode → 404', async () => {
		await expect(GET({ params: { token: '!!!!' } } as never)).rejects.toMatchObject({
			status: 404
		});
		expect(mockGetById).not.toHaveBeenCalled();
	});

	it('decoded token but post missing → falls back to old-token table, then 404', async () => {
		mockGetById.mockReturnValue(null);
		mockGetByOldToken.mockReturnValue(null);
		const token = encodeId(99);
		await expect(GET({ params: { token } } as never)).rejects.toMatchObject({
			status: 404
		});
		expect(mockGetByOldToken).toHaveBeenCalledWith(token);
	});

	it('garbage token that matches a shortlink_redirects entry → 301 to current canonical', async () => {
		mockGetByOldToken.mockReturnValue(makePost({ slug: 'renamed' }));
		await expect(GET({ params: { token: 'legacy!!' } } as never)).rejects.toMatchObject({
			status: 301,
			location: '/2026/01/15/renamed'
		});
		expect(mockGetById).not.toHaveBeenCalled();
		expect(mockGetByOldToken).toHaveBeenCalledWith('legacy!!');
	});

	it('decoded token whose post was deleted but a frozen redirect still points to a sibling post → resolves via redirect table', async () => {
		// decodeId succeeds (valid alphabet) but getPostById misses; the table
		// has a row keyed by this exact token pointing to a different post.
		mockGetById.mockReturnValue(null);
		mockGetByOldToken.mockReturnValue(makePost({ id: 7, slug: 'alt' }));
		const token = encodeId(99);
		await expect(GET({ params: { token } } as never)).rejects.toMatchObject({
			status: 301,
			location: '/2026/01/15/alt'
		});
	});
});
