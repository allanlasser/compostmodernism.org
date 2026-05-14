import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { ADMIN_PASSWORD: 'correct-horse', POST_SECRET: 'test-secret' }
}));

import { POST } from './+server';

function req(body: unknown): Request {
	return new Request('http://localhost/api/session', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

interface CookieOptions {
	path?: string;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: string;
	maxAge?: number;
}

let cookieSet: ReturnType<typeof vi.fn>;
let cookies: { set: typeof cookieSet };

beforeEach(() => {
	cookieSet = vi.fn();
	cookies = { set: cookieSet };
});

describe('POST /api/session', () => {
	it('401 when password is wrong', async () => {
		const res = await POST({ request: req({ password: 'nope' }), cookies } as never);
		expect(res.status).toBe(401);
		expect(cookieSet).not.toHaveBeenCalled();
	});

	it('200 when correct → sets httpOnly secure session cookie', async () => {
		const res = await POST({ request: req({ password: 'correct-horse' }), cookies } as never);
		expect(res.status).toBe(200);
		expect(cookieSet).toHaveBeenCalledWith(
			'session',
			'test-secret',
			expect.objectContaining<CookieOptions>({
				path: '/',
				httpOnly: true,
				secure: true,
				sameSite: 'strict'
			})
		);
	});
});
