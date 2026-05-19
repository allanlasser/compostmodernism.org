import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ImageWithUsage } from '$lib/db';

vi.mock('$lib/db', () => ({
	getImages: vi.fn(),
	countImages: vi.fn()
}));
vi.mock('$env/dynamic/private', () => ({
	env: { R2_PUBLIC_URL: 'https://images.test' }
}));

import { load, _PER_PAGE } from './+page.server';
import { getImages, countImages } from '$lib/db';

const mockGet = vi.mocked(getImages);
const mockCount = vi.mocked(countImages);

function img(over: Partial<ImageWithUsage> = {}): ImageWithUsage {
	return {
		id: 1,
		key: 'images/2026/05/13/abc.webp',
		uploaded_at: 1700000000000,
		title: null,
		alt: null,
		caption: null,
		credit: null,
		usage_count: 0,
		...over
	};
}

function makeEvent(search = '') {
	return { url: new URL(`http://localhost/admin/images${search}`) };
}

beforeEach(() => {
	mockGet.mockReset();
	mockCount.mockReset();
});

describe('admin images loader', () => {
	it('loads page 1 by default with _PER_PAGE limit and offset 0', async () => {
		mockGet.mockReturnValue([img()]);
		mockCount.mockReturnValue(7);
		const result = (await load(makeEvent() as never)) as {
			images: { url: string; key: string }[];
			page: number;
			perPage: number;
			total: number;
			totalPages: number;
		};
		expect(mockGet).toHaveBeenCalledWith({ limit: _PER_PAGE, offset: 0 });
		expect(result.page).toBe(1);
		expect(result.perPage).toBe(_PER_PAGE);
		expect(result.total).toBe(7);
		expect(result.totalPages).toBe(1);
		expect(result.images[0].url).toBe('https://images.test/images/2026/05/13/abc.webp');
	});

	it('passes offset for ?page=3', async () => {
		mockGet.mockReturnValue([]);
		mockCount.mockReturnValue(80);
		await load(makeEvent('?page=3') as never);
		expect(mockGet).toHaveBeenCalledWith({ limit: _PER_PAGE, offset: _PER_PAGE * 2 });
	});
});
