import { describe, it, expect, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { POST_SECRET: 'test-secret' }
}));

import { load } from './+layout.server';

function makeEvent(pathname: string, session?: string) {
	return {
		cookies: { get: vi.fn().mockReturnValue(session) },
		url: new URL(`http://localhost${pathname}`)
	};
}

describe('admin layout loader', () => {
	it('no session on /admin → redirect to /admin/login', async () => {
		await expect(load(makeEvent('/admin') as never)).rejects.toMatchObject({
			status: 303,
			location: '/admin/login'
		});
	});

	it('wrong session on /admin → redirect to /admin/login', async () => {
		await expect(load(makeEvent('/admin', 'nope') as never)).rejects.toMatchObject({
			status: 303,
			location: '/admin/login'
		});
	});

	it('no session on a deeper admin path → redirect to /admin/login', async () => {
		await expect(load(makeEvent('/admin/posts') as never)).rejects.toMatchObject({
			status: 303,
			location: '/admin/login'
		});
	});

	it('correct session on /admin → { authed: true }', async () => {
		const result = await load(makeEvent('/admin', 'test-secret') as never);
		expect(result).toEqual({ authed: true });
	});

	it('no session on /admin/login → lets login render with { authed: false }', async () => {
		const result = await load(makeEvent('/admin/login') as never);
		expect(result).toEqual({ authed: false });
	});

	it('correct session on /admin/login → redirect to /admin', async () => {
		await expect(load(makeEvent('/admin/login', 'test-secret') as never)).rejects.toMatchObject({
			status: 303,
			location: '/admin'
		});
	});
});
