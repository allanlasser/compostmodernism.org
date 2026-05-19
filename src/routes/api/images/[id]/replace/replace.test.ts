import { describe, it, expect, vi, beforeEach } from 'vitest';

const sharpChain = {
	rotate: vi.fn().mockReturnThis(),
	resize: vi.fn().mockReturnThis(),
	webp: vi.fn().mockReturnThis(),
	toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed-webp-bytes'))
};

vi.mock('sharp', () => ({ default: vi.fn(() => sharpChain) }));
vi.mock('$lib/r2', () => ({ uploadToR2: vi.fn() }));
vi.mock('$lib/db', () => ({ getImageById: vi.fn(), touchImage: vi.fn() }));
vi.mock('$env/dynamic/private', () => ({
	env: { POST_SECRET: 'test-secret', R2_PUBLIC_URL: 'https://images.test' }
}));

import { POST } from './+server';
import sharp from 'sharp';
import { uploadToR2 } from '$lib/r2';
import { getImageById, touchImage } from '$lib/db';

const mockSharp = vi.mocked(sharp);
const mockUpload = vi.mocked(uploadToR2);
const mockGet = vi.mocked(getImageById);
const mockTouch = vi.mocked(touchImage);

const existing = {
	id: 12,
	key: 'images/2026/05/13/abc.webp',
	uploaded_at: 1,
	title: null,
	alt: null,
	caption: null,
	credit: null
};

function makeRequest(file: File | null, auth?: string): Request {
	const form = new FormData();
	if (file) form.append('image', file);
	const headers: Record<string, string> = {};
	if (auth) headers.Authorization = auth;
	return new Request('http://localhost/api/images/12/replace', {
		method: 'POST',
		headers,
		body: form
	});
}

beforeEach(() => {
	mockSharp.mockClear();
	mockUpload.mockReset();
	mockUpload.mockResolvedValue('https://images.test/images/2026/05/13/abc.webp');
	mockGet.mockReset();
	mockTouch.mockReset();
	for (const fn of Object.values(sharpChain)) (fn as ReturnType<typeof vi.fn>).mockClear();
	sharpChain.rotate.mockReturnThis();
	sharpChain.resize.mockReturnThis();
	sharpChain.webp.mockReturnThis();
	sharpChain.toBuffer.mockResolvedValue(Buffer.from('processed-webp-bytes'));
});

describe('POST /api/images/[id]/replace', () => {
	it('401 when unauthorized', async () => {
		const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' });
		const res = await POST({ request: makeRequest(file), params: { id: '12' } } as never);
		expect(res.status).toBe(401);
	});

	it('400 when image field missing', async () => {
		mockGet.mockReturnValue(existing);
		const res = await POST({
			request: makeRequest(null, 'Bearer test-secret'),
			params: { id: '12' }
		} as never);
		expect(res.status).toBe(400);
	});

	it('404 when image id is unknown', async () => {
		mockGet.mockReturnValue(null);
		const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' });
		const res = await POST({
			request: makeRequest(file, 'Bearer test-secret'),
			params: { id: '12' }
		} as never);
		expect(res.status).toBe(404);
	});

	it('200 reuses the existing R2 key (same URL) and bumps uploaded_at', async () => {
		mockGet.mockReturnValue(existing);
		const file = new File([new Uint8Array([1, 2, 3, 4])], 'photo.jpg', { type: 'image/jpeg' });
		const res = await POST({
			request: makeRequest(file, 'Bearer test-secret'),
			params: { id: '12' }
		} as never);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.url).toBe('https://images.test/images/2026/05/13/abc.webp');
		expect(mockUpload).toHaveBeenCalledWith(existing.key, expect.any(Buffer), 'image/webp');
		expect(mockTouch).toHaveBeenCalledWith(12);
		expect(sharpChain.webp).toHaveBeenCalledWith({ quality: 82 });
	});

	it('500 when R2 upload throws; touchImage is not called', async () => {
		mockGet.mockReturnValue(existing);
		mockUpload.mockRejectedValue(new Error('boom'));
		const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' });
		const res = await POST({
			request: makeRequest(file, 'Bearer test-secret'),
			params: { id: '12' }
		} as never);
		expect(res.status).toBe(500);
		expect(mockTouch).not.toHaveBeenCalled();
	});
});
