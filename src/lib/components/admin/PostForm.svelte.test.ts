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
		await fireEvent.click(getByRole('button', { name: 'Publish' }));
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
		await fireEvent.click(getByRole('button', { name: 'Publish' }));
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
		await fireEvent.click(getByRole('button', { name: 'Publish' }));

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
		const { container, getByLabelText } = render(PostForm, {
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
		expect((getByLabelText(/^Title/) as HTMLInputElement).value).toBe('T');
		expect((getByLabelText(/^Link/) as HTMLInputElement).value).toBe('https://x');
		expect((getByLabelText(/^Tags/) as HTMLInputElement).value).toBe('a, b');
		expect((container.querySelector('textarea') as HTMLTextAreaElement).value).toBe('b');
	});

	describe('slug input (Phase 13)', () => {
		function slugInput(container: HTMLElement): HTMLInputElement | null {
			return container.querySelector('input[name="slug"]');
		}

		it('create mode → slug input rendered, empty', () => {
			const { container } = render(PostForm, { props: { mode: 'create' } });
			const input = slugInput(container);
			expect(input).not.toBeNull();
			expect(input!.value).toBe('');
		});

		it('create mode with a slug typed in → POST payload includes the slug', async () => {
			const fetchMock = stubFetchOk({ ok: true, slug: 'my-chosen-slug' });
			const { container, getByRole } = render(PostForm, { props: { mode: 'create' } });
			const bodyTextarea = container.querySelector('textarea') as HTMLTextAreaElement;
			await fireEvent.input(bodyTextarea, { target: { value: 'thinking out loud' } });
			await fireEvent.input(slugInput(container)!, { target: { value: 'my-chosen-slug' } });
			await fireEvent.click(getByRole('button', { name: 'Publish' }));

			const call = fetchMock.mock.calls[0];
			expect(call[0]).toBe('/api/post');
			expect(call[1].body).toContain('"slug":"my-chosen-slug"');
		});

		it('create mode with blank slug → POST payload omits the slug field', async () => {
			const fetchMock = stubFetchOk({ ok: true, slug: 'auto-generated' });
			const { container, getByRole } = render(PostForm, { props: { mode: 'create' } });
			const bodyTextarea = container.querySelector('textarea') as HTMLTextAreaElement;
			await fireEvent.input(bodyTextarea, { target: { value: 'just thinking' } });
			await fireEvent.click(getByRole('button', { name: 'Publish' }));

			const call = fetchMock.mock.calls[0];
			expect(call[1].body).not.toContain('"slug":');
		});

		it('edit mode → slug input rendered, prefilled with the current slug', () => {
			const { container } = render(PostForm, {
				props: { mode: 'edit', initial: { slug: 'existing', body: 'b' } }
			});
			const input = slugInput(container);
			expect(input).not.toBeNull();
			expect(input!.value).toBe('existing');
		});

		it('changing the slug → PATCH payload includes the new slug', async () => {
			const fetchMock = stubFetchOk({ ok: true, slug: 'renamed' });
			const { container, getByRole } = render(PostForm, {
				props: { mode: 'edit', initial: { slug: 'existing', body: 'b' } }
			});
			await fireEvent.input(slugInput(container)!, { target: { value: 'renamed' } });
			await fireEvent.click(getByRole('button', { name: 'Save' }));

			const call = fetchMock.mock.calls[0];
			expect(call[0]).toBe('/api/post/existing');
			expect(call[1].body).toContain('"slug":"renamed"');
		});

		it('submitting with an unchanged slug → PATCH payload omits the slug field', async () => {
			const fetchMock = stubFetchOk({ ok: true, slug: 'existing' });
			const { container, getByRole } = render(PostForm, {
				props: { mode: 'edit', initial: { slug: 'existing', body: 'b' } }
			});
			await fireEvent.click(getByRole('button', { name: 'Save' }));

			const call = fetchMock.mock.calls[0];
			expect(call[1].body).not.toContain('"slug":');
		});

		it('409 response from the server surfaces as an inline error', async () => {
			const fetchMock = vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ error: 'slug "taken" is already in use' }), {
					status: 409,
					headers: { 'Content-Type': 'application/json' }
				})
			);
			vi.stubGlobal('fetch', fetchMock);
			const { container, getByRole, findByRole } = render(PostForm, {
				props: { mode: 'edit', initial: { slug: 'existing', body: 'b' } }
			});
			await fireEvent.input(slugInput(container)!, { target: { value: 'taken' } });
			await fireEvent.click(getByRole('button', { name: 'Save' }));
			const alert = await findByRole('alert');
			expect(alert.textContent?.toLowerCase()).toContain('already in use');
		});
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
