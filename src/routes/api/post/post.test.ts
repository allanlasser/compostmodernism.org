import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/db', () => ({
	insertPost: vi.fn(),
	slugTaken: vi.fn()
}));
vi.mock('$env/dynamic/private', () => ({
	env: { POST_SECRET: 'test-secret' }
}));

import { POST } from './+server';
import { insertPost, slugTaken } from '$lib/db';

const mockInsert = vi.mocked(insertPost);
const mockSlugTaken = vi.mocked(slugTaken);

function req(body: unknown, auth?: string): Request {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (auth) headers.Authorization = auth;
	return new Request('http://localhost/api/post', {
		method: 'POST',
		headers,
		body: JSON.stringify(body)
	});
}

beforeEach(() => {
	mockInsert.mockReset();
	mockInsert.mockReturnValue({ id: 1, slug: 'hello-world' });
	mockSlugTaken.mockReset();
	mockSlugTaken.mockReturnValue(false);
});

describe('POST /api/post', () => {
	it('401 when Authorization header missing', async () => {
		const res = await POST({ request: req({ body: 'b' }) } as never);
		expect(res.status).toBe(401);
	});

	it('401 when Bearer token wrong', async () => {
		const res = await POST({ request: req({ body: 'b' }, 'Bearer wrong') } as never);
		expect(res.status).toBe(401);
	});

	it('400 when body missing', async () => {
		const res = await POST({ request: req({}, 'Bearer test-secret') } as never);
		expect(res.status).toBe(400);
	});

	it('400 when url provided without title', async () => {
		const res = await POST({
			request: req({ body: 'b', url: 'https://x' }, 'Bearer test-secret')
		} as never);
		expect(res.status).toBe(400);
	});

	it('201 plain post → returns ok + slug + permalink', async () => {
		mockInsert.mockReturnValue({ id: 1, slug: '8charhex' });
		const res = await POST({
			request: req({ body: 'a thought' }, 'Bearer test-secret')
		} as never);
		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json.ok).toBe(true);
		expect(json.slug).toBe('8charhex');
		expect(json.permalink).toMatch(/^\/\d{4}\/\d{2}\/\d{2}\/8charhex$/);
	});

	it('201 with session cookie (no Bearer header)', async () => {
		mockInsert.mockReturnValue({ id: 1, slug: '8charhex' });
		const cookies = { get: vi.fn().mockReturnValue('test-secret') };
		const res = await POST({
			request: req({ body: 'from admin UI' }),
			cookies
		} as never);
		expect(res.status).toBe(201);
		expect(mockInsert).toHaveBeenCalled();
	});

	it('201 link post → calls insertPost with url+title+tags', async () => {
		mockInsert.mockReturnValue({ id: 1, slug: 'hello-world' });
		const res = await POST({
			request: req(
				{
					body: 'commentary',
					title: 'Hello, World',
					url: 'https://x',
					tags: ['food', 'travel']
				},
				'Bearer test-secret'
			)
		} as never);
		expect(res.status).toBe(201);
		expect(mockInsert).toHaveBeenCalledWith({
			body: 'commentary',
			title: 'Hello, World',
			url: 'https://x',
			tags: ['food', 'travel']
		});
	});

	it('201 with user-provided slug → forwarded to insertPost verbatim', async () => {
		mockInsert.mockReturnValue({ id: 1, slug: 'my-chosen-slug' });
		const res = await POST({
			request: req(
				{ body: 'thinking out loud', slug: 'my-chosen-slug' },
				'Bearer test-secret'
			)
		} as never);
		expect(res.status).toBe(201);
		expect(mockSlugTaken).toHaveBeenCalledWith('my-chosen-slug');
		expect(mockInsert).toHaveBeenCalledWith(
			expect.objectContaining({ body: 'thinking out loud', slug: 'my-chosen-slug' })
		);
	});

	it('409 when user-provided slug is already taken', async () => {
		mockSlugTaken.mockReturnValue(true);
		const res = await POST({
			request: req({ body: 'b', slug: 'taken-slug' }, 'Bearer test-secret')
		} as never);
		expect(res.status).toBe(409);
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it('400 when slug has invalid characters', async () => {
		const res = await POST({
			request: req({ body: 'b', slug: 'Has Spaces' }, 'Bearer test-secret')
		} as never);
		expect(res.status).toBe(400);
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it('trims whitespace and coerces empty strings to null', async () => {
		await POST({
			request: req(
				{ body: '  hi  ', title: '   ', url: '   ', tags: ['a', '', null] },
				'Bearer test-secret'
			)
		} as never);
		expect(mockInsert).toHaveBeenCalledWith({
			body: 'hi',
			title: null,
			url: null,
			tags: ['a']
		});
	});
});
