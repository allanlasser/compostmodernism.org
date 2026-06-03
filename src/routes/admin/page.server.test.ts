import { describe, it, expect } from 'vitest';
import { load } from './+page.server';

describe('admin index loader', () => {
	it('returns cadence data', async () => {
		const result = await load({} as never) as { cadence: unknown[] };
		expect(result).toHaveProperty('cadence');
		expect(Array.isArray(result.cadence)).toBe(true);
	});
});
