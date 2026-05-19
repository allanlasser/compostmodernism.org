import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('@aws-sdk/client-s3', () => ({
	S3Client: vi.fn(() => ({ send: sendMock })),
	PutObjectCommand: vi.fn((input) => ({ kind: 'put', input })),
	DeleteObjectCommand: vi.fn((input) => ({ kind: 'delete', input }))
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
		R2_ACCOUNT_ID: 'acct',
		R2_ACCESS_KEY_ID: 'akid',
		R2_SECRET_ACCESS_KEY: 'sak',
		R2_BUCKET: 'bucket',
		R2_PUBLIC_URL: 'https://images.test'
	}
}));

import { uploadToR2, deleteFromR2 } from './r2';

beforeEach(() => {
	sendMock.mockReset();
	sendMock.mockResolvedValue(undefined);
});

describe('uploadToR2', () => {
	it('sends a PutObjectCommand and returns the public URL', async () => {
		const url = await uploadToR2('images/2026/05/13/abc.webp', Buffer.from('x'), 'image/webp');
		expect(sendMock).toHaveBeenCalledTimes(1);
		const cmd = sendMock.mock.calls[0][0] as { kind: string; input: { Bucket: string; Key: string; ContentType: string } };
		expect(cmd.kind).toBe('put');
		expect(cmd.input.Bucket).toBe('bucket');
		expect(cmd.input.Key).toBe('images/2026/05/13/abc.webp');
		expect(cmd.input.ContentType).toBe('image/webp');
		expect(url).toBe('https://images.test/images/2026/05/13/abc.webp');
	});
});

describe('deleteFromR2', () => {
	it('sends a DeleteObjectCommand with the right bucket and key', async () => {
		await deleteFromR2('images/2026/05/13/abc.webp');
		expect(sendMock).toHaveBeenCalledTimes(1);
		const cmd = sendMock.mock.calls[0][0] as { kind: string; input: { Bucket: string; Key: string } };
		expect(cmd.kind).toBe('delete');
		expect(cmd.input.Bucket).toBe('bucket');
		expect(cmd.input.Key).toBe('images/2026/05/13/abc.webp');
	});

	it('propagates errors from the S3 client', async () => {
		sendMock.mockRejectedValue(new Error('boom'));
		await expect(deleteFromR2('images/x.webp')).rejects.toThrow('boom');
	});
});
