import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import Page from './+page.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('admin new-post page', () => {
	it('renders the new-post header and a PostForm', () => {
		const { getByText, container } = render(Page);
		expect(getByText('New post')).not.toBeNull();
		expect(container.querySelector('form.post-form')).not.toBeNull();
	});

	it('after a successful POST, navigates to /admin/posts/[new-slug]', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ ok: true, slug: 'brand-new' }), {
				status: 201,
				headers: { 'Content-Type': 'application/json' }
			})
		);
		vi.stubGlobal('fetch', fetchMock);
		const locationStub = { href: '/admin/posts/new' };
		vi.stubGlobal('location', locationStub);

		const { container, getByRole } = render(Page);
		const body = container.querySelector('textarea') as HTMLTextAreaElement;
		await fireEvent.input(body, { target: { value: 'a new post' } });
		await fireEvent.click(getByRole('button', { name: 'Publish' }));

		// Wait microtasks for fetch + onSuccess.
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
		expect(locationStub.href).toBe('/admin/posts/brand-new');
	});
});
