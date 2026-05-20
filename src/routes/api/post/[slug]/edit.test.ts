import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/db', () => ({
	getPostBySlug: vi.fn(),
	updatePost: vi.fn(),
	deletePost: vi.fn(),
	slugTaken: vi.fn()
}));
vi.mock('$env/dynamic/private', () => ({
	env: { POST_SECRET: 'test-secret' }
}));

import { PATCH, DELETE } from './+server';
import { getPostBySlug, updatePost, deletePost, slugTaken } from '$lib/db';

const mockGet = vi.mocked(getPostBySlug);
const mockUpdate = vi.mocked(updatePost);
const mockDelete = vi.mocked(deletePost);
const mockSlugTaken = vi.mocked(slugTaken);

function req(body: unknown, auth?: string): Request {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (auth) headers.Authorization = auth;
	return new Request('http://localhost/api/post/x', {
		method: 'PATCH',
		headers,
		body: JSON.stringify(body)
	});
}

function cookies(session?: string) {
	return { get: vi.fn().mockReturnValue(session) };
}

const existing = {
	id: 1,
	slug: 'hello',
	body: 'old body',
	title: 'Old Title',
	url: null,
	created_at: 1700000000000,
	type: 'post' as const,
	date: 1700000000000,
	tags: []
};

beforeEach(() => {
	mockGet.mockReset();
	mockUpdate.mockReset();
	mockDelete.mockReset();
	mockSlugTaken.mockReset();
	mockSlugTaken.mockReturnValue(false);
});

describe('PATCH /api/post/[slug]', () => {
	it('401 when unauthorized', async () => {
		const res = await PATCH({ request: req({}), params: { slug: 'hello' } } as never);
		expect(res.status).toBe(401);
	});

	it('404 when slug does not exist', async () => {
		mockGet.mockReturnValue(null);
		const res = await PATCH({
			request: req({ body: 'x' }, 'Bearer test-secret'),
			params: { slug: 'nope' }
		} as never);
		expect(res.status).toBe(404);
	});

	it('partial update — unset body falls back to existing', async () => {
		mockGet.mockReturnValue(existing);
		await PATCH({
			request: req({ title: 'New Title' }, 'Bearer test-secret'),
			params: { slug: 'hello' }
		} as never);
		expect(mockUpdate).toHaveBeenCalledWith(
			'hello',
			expect.objectContaining({ body: 'old body', title: 'New Title' })
		);
	});

	it('400 when url provided without title', async () => {
		mockGet.mockReturnValue(existing);
		const res = await PATCH({
			request: req({ url: 'https://x', title: '' }, 'Bearer test-secret'),
			params: { slug: 'hello' }
		} as never);
		expect(res.status).toBe(400);
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it('200 valid update returns ok with the (unchanged) slug', async () => {
		mockGet.mockReturnValue(existing);
		const res = await PATCH({
			request: req({ body: 'new body' }, 'Bearer test-secret'),
			params: { slug: 'hello' }
		} as never);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true, slug: 'hello' });
	});

	it('200 valid update with session cookie (no Bearer header)', async () => {
		mockGet.mockReturnValue(existing);
		const res = await PATCH({
			request: req({ body: 'new body' }),
			cookies: cookies('test-secret'),
			params: { slug: 'hello' }
		} as never);
		expect(res.status).toBe(200);
		expect(mockUpdate).toHaveBeenCalled();
	});

	it('omitted title keeps existing value', async () => {
		mockGet.mockReturnValue(existing);
		await PATCH({
			request: req({ body: 'new body' }, 'Bearer test-secret'),
			params: { slug: 'hello' }
		} as never);
		expect(mockUpdate).toHaveBeenCalledWith(
			'hello',
			expect.objectContaining({ title: 'Old Title' })
		);
	});

	it('null title clears existing value', async () => {
		mockGet.mockReturnValue(existing);
		await PATCH({
			request: req({ body: 'new body', title: null }, 'Bearer test-secret'),
			params: { slug: 'hello' }
		} as never);
		expect(mockUpdate).toHaveBeenCalledWith(
			'hello',
			expect.objectContaining({ title: null })
		);
	});

	it('passes tags array through to updatePost', async () => {
		mockGet.mockReturnValue(existing);
		await PATCH({
			request: req({ body: 'b', tags: ['a', 'b'] }, 'Bearer test-secret'),
			params: { slug: 'hello' }
		} as never);
		expect(mockUpdate).toHaveBeenCalledWith(
			'hello',
			expect.objectContaining({ tags: ['a', 'b'] })
		);
	});

	it('rename to an unused slug → 200 + { ok, slug: newSlug }', async () => {
		mockGet.mockReturnValue(existing);
		mockSlugTaken.mockReturnValue(false);
		const res = await PATCH({
			request: req({ slug: 'greetings' }, 'Bearer test-secret'),
			params: { slug: 'hello' }
		} as never);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true, slug: 'greetings' });
		expect(mockUpdate).toHaveBeenCalledWith(
			'hello',
			expect.objectContaining({ slug: 'greetings' })
		);
	});

	it('rename to a slug already used by another post → 409', async () => {
		mockGet.mockReturnValue(existing);
		mockSlugTaken.mockReturnValue(true);
		const res = await PATCH({
			request: req({ slug: 'taken' }, 'Bearer test-secret'),
			params: { slug: 'hello' }
		} as never);
		expect(res.status).toBe(409);
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it('rename to the same slug is a no-op — does not call slugTaken, succeeds', async () => {
		mockGet.mockReturnValue(existing);
		const res = await PATCH({
			request: req({ slug: 'hello' }, 'Bearer test-secret'),
			params: { slug: 'hello' }
		} as never);
		expect(res.status).toBe(200);
		expect(mockSlugTaken).not.toHaveBeenCalled();
		expect(mockUpdate).toHaveBeenCalled();
	});

	it('invalid slug format → 400 (zod)', async () => {
		mockGet.mockReturnValue(existing);
		const res = await PATCH({
			request: req({ slug: 'Has Spaces' }, 'Bearer test-secret'),
			params: { slug: 'hello' }
		} as never);
		expect(res.status).toBe(400);
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it('created_at update is forwarded to updatePost', async () => {
		mockGet.mockReturnValue(existing);
		const newDate = existing.created_at + 86400000;
		const res = await PATCH({
			request: req({ created_at: newDate }, 'Bearer test-secret'),
			params: { slug: 'hello' }
		} as never);
		expect(res.status).toBe(200);
		expect(mockUpdate).toHaveBeenCalledWith(
			'hello',
			expect.objectContaining({ created_at: newDate })
		);
	});
});

function delReq(auth?: string): Request {
	const headers: Record<string, string> = {};
	if (auth) headers.Authorization = auth;
	return new Request('http://localhost/api/post/x', { method: 'DELETE', headers });
}

describe('DELETE /api/post/[slug]', () => {
	it('401 when unauthorized', async () => {
		const res = await DELETE({ request: delReq(), params: { slug: 'hello' } } as never);
		expect(res.status).toBe(401);
		expect(mockDelete).not.toHaveBeenCalled();
	});

	it('404 when slug does not exist', async () => {
		mockGet.mockReturnValue(null);
		const res = await DELETE({
			request: delReq('Bearer test-secret'),
			params: { slug: 'nope' }
		} as never);
		expect(res.status).toBe(404);
		expect(mockDelete).not.toHaveBeenCalled();
	});

	it('200 when authorized and post exists → calls deletePost', async () => {
		mockGet.mockReturnValue(existing);
		const res = await DELETE({
			request: delReq('Bearer test-secret'),
			params: { slug: 'hello' }
		} as never);
		expect(res.status).toBe(200);
		expect(mockDelete).toHaveBeenCalledWith('hello');
		expect(await res.json()).toEqual({ ok: true });
	});

	it('also accepts session cookie auth', async () => {
		mockGet.mockReturnValue(existing);
		const res = await DELETE({
			request: delReq(),
			cookies: cookies('test-secret'),
			params: { slug: 'hello' }
		} as never);
		expect(res.status).toBe(200);
		expect(mockDelete).toHaveBeenCalledWith('hello');
	});
});
