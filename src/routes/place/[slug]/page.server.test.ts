import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Post } from '$lib/db';

vi.mock('$lib/db', () => ({ getPlaceBySlug: vi.fn(), getPostsByPlace: vi.fn() }));

import { load } from './+page.server';
import { getPlaceBySlug, getPostsByPlace } from '$lib/db';

const ts = Date.UTC(2026, 0, 15);
const lisbon = { name: 'Lisbon, Portugal', slug: 'lisbon-portugal' };
function makePost(over: Partial<Post> = {}): Post {
	return {
		id: 1,
		slug: 's',
		body: 'b',
		title: null,
		url: null,
		created_at: ts,
		draft: 0,
		type: 'post',
		date: ts,
		tags: [],
		place: lisbon,
		...over
	};
}

beforeEach(() => {
	vi.mocked(getPlaceBySlug).mockReset();
	vi.mocked(getPostsByPlace).mockReset();
});

describe('place-feed loader', () => {
	it('known place → returns { place, feed } with permalinks', async () => {
		vi.mocked(getPlaceBySlug).mockReturnValue(lisbon);
		vi.mocked(getPostsByPlace).mockReturnValue([makePost({ slug: 'a' })]);
		const result = (await load({ params: { slug: 'lisbon-portugal' } } as never)) as {
			place: typeof lisbon;
			feed: { permalink: string }[];
		};
		expect(result.place).toEqual(lisbon);
		expect(result.feed[0].permalink).toBe('/2026/01/15/a');
	});

	it('unknown place → throws 404', async () => {
		vi.mocked(getPlaceBySlug).mockReturnValue(null);
		vi.mocked(getPostsByPlace).mockReturnValue(null);
		await expect(load({ params: { slug: 'atlantis' } } as never)).rejects.toMatchObject({
			status: 404
		});
	});
});
