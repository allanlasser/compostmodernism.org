import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/db', () => ({ getPlaces: vi.fn() }));

import { load } from './+page.server';
import { getPlaces } from '$lib/db';

describe('admin new-post loader', () => {
	it('returns known places for the place picker', async () => {
		const home = { id: 1, name: 'Home', slug: 'home', latitude: 1, longitude: 2, created_at: 0, count: 3 };
		vi.mocked(getPlaces).mockReturnValue([home]);
		expect(await load({} as never)).toEqual({ places: [home] });
	});
});
