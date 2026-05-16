import { describe, it, expect, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { POST_SECRET: 'test-secret' }
}));

import { load } from './+layout.server';

function makeEvent(session?: string) {
	return { cookies: { get: vi.fn().mockReturnValue(session) } };
}

describe('root layout loader', () => {
	it('admin=false when no session cookie', async () => {
		const result = await load(makeEvent() as never);
		expect(result).toEqual({ admin: false });
	});

	it('admin=false when session cookie does not match POST_SECRET', async () => {
		const result = await load(makeEvent('wrong') as never);
		expect(result).toEqual({ admin: false });
	});

	it('admin=true when session cookie matches POST_SECRET', async () => {
		const result = await load(makeEvent('test-secret') as never);
		expect(result).toEqual({ admin: true });
	});
});
