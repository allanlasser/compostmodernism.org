import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import ImageUploadModal from './ImageUploadModal.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function withFile(input: HTMLInputElement, file: File) {
	Object.defineProperty(input, 'files', { value: [file], writable: false });
}

describe('ImageUploadModal', () => {
	it('renders a file picker and Upload & insert button', () => {
		const { container, getByRole } = render(ImageUploadModal, {
			props: { onInsert: vi.fn(), onClose: vi.fn() }
		});
		expect(container.querySelector('input[type="file"]')).not.toBeNull();
		const uploadButton = getByRole('button', { name: 'Upload & insert' }) as HTMLButtonElement;
		expect(uploadButton.disabled).toBe(true);
	});

	it('uploads on click and calls onInsert with the returned URL', async () => {
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
		withFile(fileInput, new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' }));
		await fireEvent.change(fileInput);
		await fireEvent.click(getByRole('button', { name: 'Upload & insert' }));

		await Promise.resolve();
		await Promise.resolve();

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/upload',
			expect.objectContaining({ method: 'POST' })
		);
		expect(onInsert).toHaveBeenCalledWith('https://images.test/x.webp');
	});

	it('shows error message on failed upload', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
		vi.stubGlobal('fetch', fetchMock);
		const onInsert = vi.fn();

		const { container, getByRole, findByRole } = render(ImageUploadModal, {
			props: { onInsert, onClose: vi.fn() }
		});
		const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
		withFile(fileInput, new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' }));
		await fireEvent.change(fileInput);
		await fireEvent.click(getByRole('button', { name: 'Upload & insert' }));

		const alert = await findByRole('alert');
		expect(alert.textContent).toContain('Upload failed');
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
