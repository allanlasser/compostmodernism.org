import { describe, it, expect } from 'vitest';
import { load } from './+page.server';

describe('admin index loader', () => {
	it('redirects to /admin/posts', async () => {
		await expect(load({} as never)).rejects.toMatchObject({
			status: 303,
			location: '/admin/posts'
		});
	});
});
