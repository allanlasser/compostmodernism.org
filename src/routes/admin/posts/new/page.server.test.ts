import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/db', () => ({ getPlaceNames: vi.fn() }));

import { load } from './+page.server';
import { getPlaceNames } from '$lib/db';

describe('admin new-post loader', () => {
	it('returns known place names for autocomplete', async () => {
		vi.mocked(getPlaceNames).mockReturnValue(['Home']);
		expect(await load({} as never)).toEqual({ places: ['Home'] });
	});
});
