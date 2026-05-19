import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/db', () => ({
	getImageById: vi.fn(),
	updateImage: vi.fn(),
	getPostsForImage: vi.fn(),
	deleteImage: vi.fn()
}));
vi.mock('$lib/r2', () => ({ deleteFromR2: vi.fn() }));
vi.mock('$env/dynamic/private', () => ({
	env: { POST_SECRET: 'test-secret', R2_PUBLIC_URL: 'https://images.test' }
}));

import { PATCH, DELETE } from './+server';
import { getImageById, updateImage, getPostsForImage, deleteImage } from '$lib/db';
import { deleteFromR2 } from '$lib/r2';

const mockGet = vi.mocked(getImageById);
const mockUpdate = vi.mocked(updateImage);
const mockUsage = vi.mocked(getPostsForImage);
const mockDelete = vi.mocked(deleteImage);
const mockR2Delete = vi.mocked(deleteFromR2);

const existing = {
	id: 12,
	key: 'images/2026/05/13/abc.webp',
	uploaded_at: 1,
	title: null,
	alt: null,
	caption: null,
	credit: null
};

function patchReq(body: unknown, auth?: string): Request {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (auth) headers.Authorization = auth;
	return new Request('http://localhost/api/images/12', {
		method: 'PATCH',
		headers,
		body: JSON.stringify(body)
	});
}

function delReq(search = '', auth?: string): Request {
	const headers: Record<string, string> = {};
	if (auth) headers.Authorization = auth;
	return new Request(`http://localhost/api/images/12${search}`, { method: 'DELETE', headers });
}

beforeEach(() => {
	mockGet.mockReset();
	mockUpdate.mockReset();
	mockUsage.mockReset();
	mockDelete.mockReset();
	mockR2Delete.mockReset();
	mockR2Delete.mockResolvedValue(undefined);
});

describe('PATCH /api/images/[id]', () => {
	it('401 when unauthorized', async () => {
		const res = await PATCH({ request: patchReq({ alt: 'x' }), params: { id: '12' } } as never);
		expect(res.status).toBe(401);
	});

	it('400 when id is not an integer', async () => {
		const res = await PATCH({
			request: patchReq({ alt: 'x' }, 'Bearer test-secret'),
			params: { id: 'NaN' }
		} as never);
		expect(res.status).toBe(400);
	});

	it('404 when image not found', async () => {
		mockGet.mockReturnValue(null);
		const res = await PATCH({
			request: patchReq({ alt: 'x' }, 'Bearer test-secret'),
			params: { id: '12' }
		} as never);
		expect(res.status).toBe(404);
	});

	it('200 updates metadata and returns the refreshed row', async () => {
		mockGet.mockReturnValueOnce(existing).mockReturnValueOnce({ ...existing, alt: 'a description' });
		const res = await PATCH({
			request: patchReq({ alt: 'a description' }, 'Bearer test-secret'),
			params: { id: '12' }
		} as never);
		expect(res.status).toBe(200);
		expect(mockUpdate).toHaveBeenCalledWith(12, expect.objectContaining({ alt: 'a description' }));
		const json = await res.json();
		expect(json.image.alt).toBe('a description');
	});
});

describe('DELETE /api/images/[id]', () => {
	it('401 when unauthorized', async () => {
		const res = await DELETE({ request: delReq(), params: { id: '12' } } as never);
		expect(res.status).toBe(401);
	});

	it('404 when image not found', async () => {
		mockGet.mockReturnValue(null);
		const res = await DELETE({
			request: delReq('', 'Bearer test-secret'),
			params: { id: '12' },
			url: new URL('http://localhost/api/images/12')
		} as never);
		expect(res.status).toBe(404);
	});

	it('409 when image is referenced and ?force is not set', async () => {
		mockGet.mockReturnValue(existing);
		mockUsage.mockReturnValue([{ slug: 'a', title: 'A' }, { slug: 'b', title: null }]);
		const res = await DELETE({
			request: delReq('', 'Bearer test-secret'),
			params: { id: '12' },
			url: new URL('http://localhost/api/images/12')
		} as never);
		expect(res.status).toBe(409);
		const json = await res.json();
		expect(json.error).toMatch(/in use/i);
		expect(json.posts).toEqual([{ slug: 'a', title: 'A' }, { slug: 'b', title: null }]);
		expect(mockDelete).not.toHaveBeenCalled();
		expect(mockR2Delete).not.toHaveBeenCalled();
	});

	it('200 deletes from R2 then DB when not referenced', async () => {
		mockGet.mockReturnValue(existing);
		mockUsage.mockReturnValue([]);
		mockDelete.mockReturnValue({ key: existing.key });
		const res = await DELETE({
			request: delReq('', 'Bearer test-secret'),
			params: { id: '12' },
			url: new URL('http://localhost/api/images/12')
		} as never);
		expect(res.status).toBe(200);
		expect(mockR2Delete).toHaveBeenCalledWith(existing.key);
		expect(mockDelete).toHaveBeenCalledWith(12);
	});

	it('200 with ?force=true deletes even when referenced', async () => {
		mockGet.mockReturnValue(existing);
		mockUsage.mockReturnValue([{ slug: 'a', title: 'A' }]);
		mockDelete.mockReturnValue({ key: existing.key });
		const res = await DELETE({
			request: delReq('?force=true', 'Bearer test-secret'),
			params: { id: '12' },
			url: new URL('http://localhost/api/images/12?force=true')
		} as never);
		expect(res.status).toBe(200);
		expect(mockR2Delete).toHaveBeenCalledWith(existing.key);
		expect(mockDelete).toHaveBeenCalledWith(12);
	});

	it('500 if R2 delete fails; DB row is preserved', async () => {
		mockGet.mockReturnValue(existing);
		mockUsage.mockReturnValue([]);
		mockR2Delete.mockRejectedValue(new Error('boom'));
		const res = await DELETE({
			request: delReq('', 'Bearer test-secret'),
			params: { id: '12' },
			url: new URL('http://localhost/api/images/12')
		} as never);
		expect(res.status).toBe(500);
		expect(mockDelete).not.toHaveBeenCalled();
	});
});
