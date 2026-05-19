import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import ImagesTable from './ImagesTable.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

type Row = {
	id: number;
	key: string;
	url: string;
	uploaded_at: number;
	title: string | null;
	alt: string | null;
	caption: string | null;
	credit: string | null;
	usage_count: number;
};

function img(over: Partial<Row> = {}): Row {
	return {
		id: 1,
		key: 'images/2026/05/13/abc.webp',
		url: 'https://images.test/images/2026/05/13/abc.webp',
		uploaded_at: Date.UTC(2026, 4, 13),
		title: null,
		alt: null,
		caption: null,
		credit: null,
		usage_count: 0,
		...over
	};
}

describe('ImagesTable', () => {
	it('renders one row per image with thumbnail and key', () => {
		const { container } = render(ImagesTable, {
			props: { images: [img({ id: 1, key: 'a.webp', url: 'https://i.test/a.webp' })] }
		});
		const rows = container.querySelectorAll('tbody tr');
		expect(rows.length).toBe(1);
		const thumb = container.querySelector('img.thumb') as HTMLImageElement;
		expect(thumb).not.toBeNull();
		expect(thumb.src).toBe('https://i.test/a.webp');
		expect(container.textContent).toContain('a.webp');
	});

	it('Copy URL writes the public URL to clipboard', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		const { getByRole } = render(ImagesTable, { props: { images: [img()] } });
		await fireEvent.click(getByRole('button', { name: 'Copy URL' }));
		expect(writeText).toHaveBeenCalledWith('https://images.test/images/2026/05/13/abc.webp');
	});

	it('Edit toggles input fields and Save PATCHes /api/images/[id]', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ ok: true, image: { alt: 'a new alt' } }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);
		vi.stubGlobal('fetch', fetchMock);

		const { container, getByRole, getAllByRole } = render(ImagesTable, {
			props: { images: [img({ id: 5 })] }
		});
		await fireEvent.click(getByRole('button', { name: 'Edit' }));
		const inputs = container.querySelectorAll('.meta-edit input');
		expect(inputs.length).toBe(4);
		// Set the Alt input (the second one).
		await fireEvent.input(inputs[1], { target: { value: 'a new alt' } });
		await fireEvent.click(getAllByRole('button', { name: 'Save' })[0]);

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/images/5',
			expect.objectContaining({
				method: 'PATCH',
				body: expect.stringContaining('"alt":"a new alt"')
			})
		);
	});

	it('Delete (unreferenced): confirm + DELETE removes the row', async () => {
		vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		const { container, getByRole } = render(ImagesTable, {
			props: { images: [img({ id: 7, key: 'a.webp' })] }
		});
		await fireEvent.click(getByRole('button', { name: 'Delete' }));
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(fetchMock).toHaveBeenCalledWith('/api/images/7', { method: 'DELETE' });
		expect(container.querySelector('img.thumb')).toBeNull();
	});

	it('Delete (referenced 409): second confirm triggers force=true delete', async () => {
		const confirmMock = vi.fn().mockReturnValue(true);
		vi.stubGlobal('confirm', confirmMock);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ error: 'in use', posts: [{ slug: 'p1', title: 'P1' }] }), {
					status: 409,
					headers: { 'Content-Type': 'application/json' }
				})
			)
			.mockResolvedValueOnce(new Response(null, { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		const { container, getByRole } = render(ImagesTable, {
			props: { images: [img({ id: 9, usage_count: 1 })] }
		});
		await fireEvent.click(getByRole('button', { name: 'Delete' }));
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(confirmMock).toHaveBeenCalledTimes(2);
		expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/images/9', { method: 'DELETE' });
		expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/images/9?force=true', { method: 'DELETE' });
		expect(container.querySelector('img.thumb')).toBeNull();
	});

	it('Replace: clicking Replace triggers the hidden file input, then POSTs to /replace', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		const { container, getByRole } = render(ImagesTable, {
			props: { images: [img({ id: 11 })] }
		});
		const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
		const file = new File([new Uint8Array([1, 2, 3])], 'new.jpg', { type: 'image/jpeg' });
		// Simulate the file selection.
		Object.defineProperty(fileInput, 'files', { value: [file], writable: false });
		await fireEvent.change(fileInput);

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/images/11/replace',
			expect.objectContaining({ method: 'POST' })
		);
		expect(getByRole('button', { name: 'Replace' })).not.toBeNull();
	});

	it('shows empty state when images is empty', () => {
		const { getByText } = render(ImagesTable, { props: { images: [] } });
		expect(getByText('No images yet.')).not.toBeNull();
	});
});
