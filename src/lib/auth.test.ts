import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { POST_SECRET: 'test-secret' }
}));

import { isAuthorized } from './auth';

function evt(opts: { auth?: string; session?: string }) {
	const headers = new Headers();
	if (opts.auth) headers.set('Authorization', opts.auth);
	const request = new Request('http://localhost/x', { headers });
	const cookies = { get: vi.fn().mockReturnValue(opts.session) } as unknown as {
		get: (name: string) => string | undefined;
	};
	return { request, cookies };
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('isAuthorized', () => {
	it('false when neither header nor cookie present', () => {
		expect(isAuthorized(evt({}))).toBe(false);
	});

	it('true with correct Bearer token', () => {
		expect(isAuthorized(evt({ auth: 'Bearer test-secret' }))).toBe(true);
	});

	it('false with wrong Bearer token', () => {
		expect(isAuthorized(evt({ auth: 'Bearer wrong' }))).toBe(false);
	});

	it('true with correct session cookie', () => {
		expect(isAuthorized(evt({ session: 'test-secret' }))).toBe(true);
	});

	it('false with wrong session cookie', () => {
		expect(isAuthorized(evt({ session: 'wrong' }))).toBe(false);
	});

	it('tolerates missing cookies object (e.g. in unit tests that omit it)', () => {
		const headers = new Headers({ Authorization: 'Bearer test-secret' });
		const request = new Request('http://localhost/x', { headers });
		expect(isAuthorized({ request } as never)).toBe(true);
	});
});
