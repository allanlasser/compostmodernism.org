import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/db', () => ({
	getPostBySlug: vi.fn(),
	updatePost: vi.fn()
}));
vi.mock('$env/dynamic/private', () => ({
	env: { POST_SECRET: 'test-secret' }
}));

import { PATCH } from './+server';
import { getPostBySlug, updatePost } from '$lib/db';

const mockGet = vi.mocked(getPostBySlug);
const mockUpdate = vi.mocked(updatePost);

function req(body: unknown, auth?: string): Request {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (auth) headers.Authorization = auth;
	return new Request('http://localhost/api/post/x', {
		method: 'PATCH',
		headers,
		body: JSON.stringify(body)
	});
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

	it('200 valid update returns ok', async () => {
		mockGet.mockReturnValue(existing);
		const res = await PATCH({
			request: req({ body: 'new body' }, 'Bearer test-secret'),
			params: { slug: 'hello' }
		} as never);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
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
});
