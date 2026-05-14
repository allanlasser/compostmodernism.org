import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Post } from '$lib/db';

vi.mock('$lib/db', () => ({ getPostsByTag: vi.fn() }));

import { load } from './+page.server';
import { getPostsByTag } from '$lib/db';

const mockGet = vi.mocked(getPostsByTag);

const ts = Date.UTC(2026, 0, 15);
function makePost(over: Partial<Post> = {}): Post {
	return {
		id: 1,
		slug: 's',
		body: 'b',
		title: null,
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

describe('tag-feed loader', () => {
	it('known tag with posts → returns { tag, feed } with permalinks', async () => {
		mockGet.mockReturnValue([makePost({ slug: 'a' })]);
		const result = await load({ params: { slug: 'food' } } as never);
		expect((result as { tag: string }).tag).toBe('food');
		expect((result as { feed: { permalink: string }[] }).feed[0].permalink).toBe(
			'/2026/01/15/a'
		);
	});

	it('unknown tag (db returns null) → throws 404', async () => {
		mockGet.mockReturnValue(null);
		await expect(load({ params: { slug: 'nope' } } as never)).rejects.toMatchObject({
			status: 404
		});
	});

	it('existing tag with no posts (db returns []) → returns empty feed, no 404', async () => {
		mockGet.mockReturnValue([]);
		const result = await load({ params: { slug: 'orphan' } } as never);
		expect((result as { tag: string }).tag).toBe('orphan');
		expect((result as { feed: unknown[] }).feed).toEqual([]);
	});
});
