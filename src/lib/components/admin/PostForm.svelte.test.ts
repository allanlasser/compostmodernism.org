import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import PostForm from './PostForm.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function stubFetchOk(payload: unknown = {}) {
	const mock = vi.fn().mockResolvedValue(
		new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } })
	);
	vi.stubGlobal('fetch', mock);
	return mock;
}

describe('PostForm', () => {
	it('blocks submit and surfaces an error when body is empty', async () => {
		const fetchMock = stubFetchOk();
		const { container, getByRole } = render(PostForm, { props: { mode: 'create' } });
		await fireEvent.click(getByRole('button', { name: 'Post' }));
		expect(container.querySelector('.field-error')).not.toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('blocks submit when a URL is provided without a title', async () => {
		const fetchMock = stubFetchOk();
		const { container, getByRole, getByText } = render(PostForm, { props: { mode: 'create' } });
		const inputs = container.querySelectorAll('input');
		const textareas = container.querySelectorAll('textarea');
		// Inputs in order: title, url, tags. Set url + body but leave title empty.
		await fireEvent.input(inputs[1], { target: { value: 'https://example.com' } });
		await fireEvent.input(textareas[0], { target: { value: 'commentary' } });
		await fireEvent.click(getByRole('button', { name: 'Post' }));
		expect(getByText(/link post needs a title/i)).not.toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('create mode: POSTs payload to /api/post and calls onSuccess with slug + parsed payload', async () => {
		const fetchMock = stubFetchOk({ ok: true, slug: 'fresh-slug' });
		const onSuccess = vi.fn();
		const { container, getByRole } = render(PostForm, {
			props: { mode: 'create', onSuccess }
		});
		const [titleInput, , tagsInput] = container.querySelectorAll('input');
		const bodyTextarea = container.querySelector('textarea') as HTMLTextAreaElement;
		await fireEvent.input(titleInput, { target: { value: 'Hello' } });
		await fireEvent.input(tagsInput, { target: { value: 'food, travel' } });
		await fireEvent.input(bodyTextarea, { target: { value: 'A post.' } });
		await fireEvent.click(getByRole('button', { name: 'Post' }));

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/post',
			expect.objectContaining({
				method: 'POST',
				body: expect.stringContaining('"title":"Hello"')
			})
		);
		// Wait a tick for the resolved promise to update onSuccess.
		await Promise.resolve();
		await Promise.resolve();
		expect(onSuccess).toHaveBeenCalledWith(
			'fresh-slug',
			expect.objectContaining({ title: 'Hello', body: 'A post.', tags: ['food', 'travel'] })
		);
	});

	it('edit mode: PATCHes /api/post/[slug] using the initial slug', async () => {
		const fetchMock = stubFetchOk({ ok: true });
		const { container, getByRole } = render(PostForm, {
			props: {
				mode: 'edit',
				initial: { slug: 'existing', body: 'old body', title: 'Old', tags: [{ name: 'x' }] }
			}
		});
		const bodyTextarea = container.querySelector('textarea') as HTMLTextAreaElement;
		await fireEvent.input(bodyTextarea, { target: { value: 'new body' } });
		await fireEvent.click(getByRole('button', { name: 'Save' }));

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/post/existing',
			expect.objectContaining({
				method: 'PATCH',
				body: expect.stringContaining('"body":"new body"')
			})
		);
	});

	it('renders a Cancel button when onCancel is provided and calls it on click', async () => {
		const onCancel = vi.fn();
		const { getByRole } = render(PostForm, {
			props: { mode: 'edit', initial: { slug: 's', body: 'b' }, onCancel }
		});
		await fireEvent.click(getByRole('button', { name: 'Cancel' }));
		expect(onCancel).toHaveBeenCalled();
	});

	it('does not render a Cancel button when onCancel is omitted', () => {
		const { container } = render(PostForm, {
			props: { mode: 'edit', initial: { slug: 's', body: 'b' } }
		});
		const buttons = Array.from(container.querySelectorAll('button')).map((b) =>
			b.textContent?.trim()
		);
		expect(buttons).not.toContain('Cancel');
	});

	it('Insert image opens modal; on insert, splices ![](url) into the body at cursor', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ ok: true, url: 'https://images.test/x.webp' }), {
				status: 201,
				headers: { 'Content-Type': 'application/json' }
			})
		);
		vi.stubGlobal('fetch', fetchMock);

		const { container, getByRole } = render(PostForm, {
			props: { mode: 'edit', initial: { slug: 's', body: 'hello world' } }
		});
		const bodyTextarea = container.querySelector('textarea') as HTMLTextAreaElement;
		// Place caret between "hello" and " world" (position 5).
		bodyTextarea.focus();
		bodyTextarea.setSelectionRange(5, 5);

		await fireEvent.click(getByRole('button', { name: 'Insert image' }));
		// Modal opens; pick a file and upload.
		const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
		Object.defineProperty(fileInput, 'files', {
			value: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })],
			writable: false
		});
		await fireEvent.change(fileInput);
		await fireEvent.click(getByRole('button', { name: 'Upload & insert' }));

		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(bodyTextarea.value).toBe('hello![](https://images.test/x.webp) world');
		// Modal should close (no file input visible anymore).
		expect(container.querySelector('input[type="file"]')).toBeNull();
	});

	it('pre-fills inputs from initial values', () => {
		const { container } = render(PostForm, {
			props: {
				mode: 'edit',
				initial: {
					slug: 's',
					body: 'b',
					title: 'T',
					url: 'https://x',
					tags: [{ name: 'a' }, { name: 'b' }]
				}
			}
		});
		const inputs = container.querySelectorAll('input');
		expect((inputs[0] as HTMLInputElement).value).toBe('T');
		expect((inputs[1] as HTMLInputElement).value).toBe('https://x');
		expect((inputs[2] as HTMLInputElement).value).toBe('a, b');
		expect((container.querySelector('textarea') as HTMLTextAreaElement).value).toBe('b');
	});

	it('shows server error message when API returns non-2xx', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ error: 'Not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			})
		);
		vi.stubGlobal('fetch', fetchMock);
		const { container, getByRole, findByRole } = render(PostForm, {
			props: { mode: 'edit', initial: { slug: 'missing' } }
		});
		const bodyTextarea = container.querySelector('textarea') as HTMLTextAreaElement;
		await fireEvent.input(bodyTextarea, { target: { value: 'whatever' } });
		await fireEvent.click(getByRole('button', { name: 'Save' }));
		const alert = await findByRole('alert');
		expect(alert.textContent).toContain('Not found');
	});
});
