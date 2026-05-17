import { describe, it, expect, vi, beforeEach } from 'vitest';

const sharpChain = {
	rotate: vi.fn().mockReturnThis(),
	resize: vi.fn().mockReturnThis(),
	withMetadata: vi.fn().mockReturnThis(),
	webp: vi.fn().mockReturnThis(),
	toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed-webp-bytes'))
};

vi.mock('sharp', () => ({ default: vi.fn(() => sharpChain) }));
vi.mock('$lib/r2', () => ({ uploadToR2: vi.fn() }));
vi.mock('$lib/db', () => ({ recordImage: vi.fn() }));
vi.mock('$env/dynamic/private', () => ({ env: { POST_SECRET: 'test-secret' } }));

import { POST } from './+server';
import sharp from 'sharp';
import { uploadToR2 } from '$lib/r2';
import { recordImage } from '$lib/db';

const mockSharp = vi.mocked(sharp);
const mockUpload = vi.mocked(uploadToR2);
const mockRecordImage = vi.mocked(recordImage);

function makeRequest(file: File | null, auth?: string): Request {
	const form = new FormData();
	if (file) form.append('image', file);
	const headers: Record<string, string> = {};
	if (auth) headers.Authorization = auth;
	return new Request('http://localhost/api/upload', { method: 'POST', headers, body: form });
}

beforeEach(() => {
	mockSharp.mockClear();
	mockUpload.mockReset();
	mockUpload.mockResolvedValue('https://images.example/key.webp');
	mockRecordImage.mockReset();
	for (const fn of Object.values(sharpChain)) (fn as ReturnType<typeof vi.fn>).mockClear();
	sharpChain.rotate.mockReturnThis();
	sharpChain.resize.mockReturnThis();
	sharpChain.withMetadata.mockReturnThis();
	sharpChain.webp.mockReturnThis();
	sharpChain.toBuffer.mockResolvedValue(Buffer.from('processed-webp-bytes'));
});

describe('POST /api/upload', () => {
	it('401 when unauthorized', async () => {
		const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' });
		const res = await POST({ request: makeRequest(file) } as never);
		expect(res.status).toBe(401);
	});

	it('400 when image field missing', async () => {
		const res = await POST({ request: makeRequest(null, 'Bearer test-secret') } as never);
		expect(res.status).toBe(400);
	});

	it('500 when sharp pipeline throws', async () => {
		sharpChain.toBuffer.mockRejectedValue(new Error('sharp failed'));
		const file = new File([new Uint8Array([1, 2, 3, 4])], 'photo.jpg', { type: 'image/jpeg' });
		const res = await POST({ request: makeRequest(file, 'Bearer test-secret') } as never);
		expect(res.status).toBe(500);
		const json = await res.json();
		expect(json).toMatchObject({ error: expect.any(String) });
	});

	it('500 when R2 upload throws', async () => {
		mockUpload.mockRejectedValue(new Error('R2 failed'));
		const file = new File([new Uint8Array([1, 2, 3, 4])], 'photo.jpg', { type: 'image/jpeg' });
		const res = await POST({ request: makeRequest(file, 'Bearer test-secret') } as never);
		expect(res.status).toBe(500);
		const json = await res.json();
		expect(json).toMatchObject({ error: expect.any(String) });
	});

	it('201 with session cookie (no Bearer header)', async () => {
		const file = new File([new Uint8Array([1, 2, 3, 4])], 'photo.jpg', { type: 'image/jpeg' });
		const cookies = { get: vi.fn().mockReturnValue('test-secret') };
		const res = await POST({ request: makeRequest(file), cookies } as never);
		expect(res.status).toBe(201);
		expect(mockUpload).toHaveBeenCalled();
	});

	it('201 valid upload → runs sharp pipeline and uploads to R2', async () => {
		const file = new File([new Uint8Array([1, 2, 3, 4])], 'photo.jpg', { type: 'image/jpeg' });
		const res = await POST({
			request: makeRequest(file, 'Bearer test-secret')
		} as never);

		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json).toEqual({ ok: true, url: 'https://images.example/key.webp' });

		expect(mockSharp).toHaveBeenCalledTimes(1);
		expect(sharpChain.rotate).toHaveBeenCalled();
		expect(sharpChain.resize).toHaveBeenCalledWith(
			1600,
			1600,
			expect.objectContaining({ fit: 'inside', withoutEnlargement: true })
		);
		// Sharp strips EXIF by default; .withMetadata() is the *opt-in* to keep it.
		expect(sharpChain.withMetadata).not.toHaveBeenCalled();
		expect(sharpChain.webp).toHaveBeenCalledWith({ quality: 82 });

		expect(mockUpload).toHaveBeenCalledTimes(1);
		const [key, buffer, mime] = mockUpload.mock.calls[0];
		expect(key).toMatch(/^images\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f]{8}\.webp$/);
		expect(buffer).toEqual(Buffer.from('processed-webp-bytes'));
		expect(mime).toBe('image/webp');
	});

	it('successful upload records the image in the ledger with the same key', async () => {
		const file = new File([new Uint8Array([1, 2, 3, 4])], 'photo.jpg', { type: 'image/jpeg' });
		const res = await POST({
			request: makeRequest(file, 'Bearer test-secret')
		} as never);
		expect(res.status).toBe(201);
		expect(mockRecordImage).toHaveBeenCalledTimes(1);
		expect(mockRecordImage).toHaveBeenCalledWith(mockUpload.mock.calls[0][0]);
	});
});
