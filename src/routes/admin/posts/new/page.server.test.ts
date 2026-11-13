import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/db', () => ({ getPlaceNames: vi.fn() }));

import { load } from './+page.server';
import { getPlaceNames } from '$lib/db';

describe('admin new-post loader', () => {
	it('returns known place names for autocomplete', async () => {
		const home = { name: 'Home', slug: 'home', latitude: 1, longitude: 2, count: 3 };
		vi.mocked(getPlaceNames).mockReturnValue([home]);
		expect(await load({} as never)).toEqual({ places: [home] });
	});
});
