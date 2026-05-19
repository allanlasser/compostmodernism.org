import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/db', () => ({
	getImages: vi.fn(),
	countImages: vi.fn()
}));
vi.mock('$env/dynamic/private', () => ({
	env: { POST_SECRET: 'test-secret', R2_PUBLIC_URL: 'https://images.test' }
}));

import { GET } from './+server';
import { getImages, countImages } from '$lib/db';

const mockGet = vi.mocked(getImages);
const mockCount = vi.mocked(countImages);

function req(search = '', auth?: string): Request {
	const headers: Record<string, string> = {};
	if (auth) headers.Authorization = auth;
	return new Request(`http://localhost/api/images${search}`, { method: 'GET', headers });
}

beforeEach(() => {
	mockGet.mockReset();
	mockCount.mockReset();
});

describe('GET /api/images', () => {
	it('401 when unauthorized', async () => {
		const res = await GET({ request: req() } as never);
		expect(res.status).toBe(401);
	});

	it('200 returns rows with url + total + pagination', async () => {
		mockGet.mockReturnValue([
			{
				id: 1,
				key: 'images/2026/05/13/abc.webp',
				uploaded_at: 1700000000000,
				title: null,
				alt: 'an alt',
				caption: null,
				credit: null,
				usage_count: 2
			}
		]);
		mockCount.mockReturnValue(50);
		const res = await GET({
			request: req('', 'Bearer test-secret'),
			url: new URL('http://localhost/api/images')
		} as never);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.total).toBe(50);
		expect(json.page).toBe(1);
		expect(json.perPage).toBeGreaterThan(0);
		expect(json.images[0].url).toBe('https://images.test/images/2026/05/13/abc.webp');
		expect(json.images[0].usage_count).toBe(2);
	});

	it('honours ?page parameter when computing offset', async () => {
		mockGet.mockReturnValue([]);
		mockCount.mockReturnValue(200);
		await GET({
			request: req('?page=3', 'Bearer test-secret'),
			url: new URL('http://localhost/api/images?page=3')
		} as never);
		const [opts] = mockGet.mock.calls[0];
		expect(opts).toBeDefined();
		expect(opts).toMatchObject({ offset: opts!.limit! * 2 });
	});

	it('accepts session cookie auth', async () => {
		mockGet.mockReturnValue([]);
		mockCount.mockReturnValue(0);
		const res = await GET({
			request: req(),
			cookies: { get: vi.fn().mockReturnValue('test-secret') },
			url: new URL('http://localhost/api/images')
		} as never);
		expect(res.status).toBe(200);
	});
});
