import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import ImageUploadModal from './ImageUploadModal.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function withFiles(input: HTMLInputElement, files: File[]) {
	Object.defineProperty(input, 'files', { value: files, writable: false });
}

describe('ImageUploadModal', () => {
	it('renders a multi-file picker and Upload & insert button', () => {
		const { container, getByRole } = render(ImageUploadModal, {
			props: { onInsert: vi.fn(), onClose: vi.fn() }
		});
		const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
		expect(fileInput).not.toBeNull();
		expect(fileInput.multiple).toBe(true);
		const uploadButton = getByRole('button', { name: 'Upload & insert' }) as HTMLButtonElement;
		expect(uploadButton.disabled).toBe(true);
	});

	it('uploads a single file and calls onInsert with an array of URLs', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ ok: true, url: 'https://images.test/x.webp' }), {
				status: 201,
				headers: { 'Content-Type': 'application/json' }
			})
		);
		vi.stubGlobal('fetch', fetchMock);
		const onInsert = vi.fn();

		const { container, getByRole } = render(ImageUploadModal, {
			props: { onInsert, onClose: vi.fn() }
		});
		const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
		withFiles(fileInput, [new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' })]);
		await fireEvent.change(fileInput);
		await fireEvent.click(getByRole('button', { name: 'Upload & insert' }));

		await vi.waitFor(() => expect(onInsert).toHaveBeenCalled());

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/upload',
			expect.objectContaining({ method: 'POST' })
		);
		expect(onInsert).toHaveBeenCalledWith(['https://images.test/x.webp']);
	});

	it('uploads multiple files sequentially and returns all URLs', async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ ok: true, url: 'https://images.test/a.webp' }), {
					status: 201,
					headers: { 'Content-Type': 'application/json' }
				})
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ ok: true, url: 'https://images.test/b.webp' }), {
					status: 201,
					headers: { 'Content-Type': 'application/json' }
				})
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ ok: true, url: 'https://images.test/c.webp' }), {
					status: 201,
					headers: { 'Content-Type': 'application/json' }
				})
			);
		vi.stubGlobal('fetch', fetchMock);
		const onInsert = vi.fn();

		const { container, getByRole } = render(ImageUploadModal, {
			props: { onInsert, onClose: vi.fn() }
		});
		const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
		withFiles(fileInput, [
			new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' }),
			new File([new Uint8Array([2])], 'b.jpg', { type: 'image/jpeg' }),
			new File([new Uint8Array([3])], 'c.jpg', { type: 'image/jpeg' })
		]);
		await fireEvent.change(fileInput);
		await fireEvent.click(getByRole('button', { name: 'Upload & insert' }));

		await vi.waitFor(() => expect(onInsert).toHaveBeenCalled());

		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(onInsert).toHaveBeenCalledWith([
			'https://images.test/a.webp',
			'https://images.test/b.webp',
			'https://images.test/c.webp'
		]);
	});

	it('inserts successful URLs even when some uploads fail', async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ ok: true, url: 'https://images.test/a.webp' }), {
					status: 201,
					headers: { 'Content-Type': 'application/json' }
				})
			)
			.mockResolvedValueOnce(new Response(null, { status: 500 }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ ok: true, url: 'https://images.test/c.webp' }), {
					status: 201,
					headers: { 'Content-Type': 'application/json' }
				})
			);
		vi.stubGlobal('fetch', fetchMock);
		const onInsert = vi.fn();

		const { container, getByRole, findByRole } = render(ImageUploadModal, {
			props: { onInsert, onClose: vi.fn() }
		});
		const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
		withFiles(fileInput, [
			new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' }),
			new File([new Uint8Array([2])], 'b.jpg', { type: 'image/jpeg' }),
			new File([new Uint8Array([3])], 'c.jpg', { type: 'image/jpeg' })
		]);
		await fireEvent.change(fileInput);
		await fireEvent.click(getByRole('button', { name: 'Upload & insert' }));

		await vi.waitFor(() => expect(onInsert).toHaveBeenCalled());

		expect(onInsert).toHaveBeenCalledWith([
			'https://images.test/a.webp',
			'https://images.test/c.webp'
		]);
		const alert = await findByRole('alert');
		expect(alert.textContent).toContain('b.jpg');
	});

	it('shows error and does not call onInsert when all uploads fail', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
		vi.stubGlobal('fetch', fetchMock);
		const onInsert = vi.fn();

		const { container, getByRole, findByRole } = render(ImageUploadModal, {
			props: { onInsert, onClose: vi.fn() }
		});
		const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
		withFiles(fileInput, [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })]);
		await fireEvent.change(fileInput);
		await fireEvent.click(getByRole('button', { name: 'Upload & insert' }));

		const alert = await findByRole('alert');
		expect(alert.textContent).toContain('failed');
		expect(onInsert).not.toHaveBeenCalled();
	});

	it('Cancel button calls onClose', async () => {
		const onClose = vi.fn();
		const { getByRole } = render(ImageUploadModal, {
			props: { onInsert: vi.fn(), onClose }
		});
		await fireEvent.click(getByRole('button', { name: 'Cancel' }));
		expect(onClose).toHaveBeenCalled();
	});
});
