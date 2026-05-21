import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import Page from './+page.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

const data = {
	post: {
		slug: 'hello',
		body: 'body text',
		title: 'Hello',
		url: null,
		tags: [{ name: 'food', slug: 'food' }],
		permalink: '/2026/01/15/hello',
		shortlink: 'https://cmpst.org/p/abcd',
		date: Date.UTC(2026, 0, 15)
	}
};

describe('admin edit-post page', () => {
	it('renders the edit header with the post permalink', () => {
		const { getByText, container } = render(Page, { props: { data } });
		expect(getByText('Edit post')).not.toBeNull();
		const permalink = container.querySelector(`a[href="${data.post.permalink}"]`);
		expect(permalink).not.toBeNull();
	});

	it('renders a permalink link to the public post', () => {
		const { container } = render(Page, { props: { data } });
		const link = container.querySelector('a[href="/2026/01/15/hello"]') as HTMLAnchorElement;
		expect(link).not.toBeNull();
		expect(link.target).toBe('_blank');
	});

	it('renders a shortlink alongside the permalink', () => {
		const { container } = render(Page, { props: { data } });
		const link = container.querySelector(
			`a[href="${data.post.shortlink}"]`
		) as HTMLAnchorElement;
		expect(link).not.toBeNull();
		expect(link.target).toBe('_blank');
		expect(link.textContent).toBe(data.post.shortlink);
	});

	it('renders a PostForm pre-filled from the post', () => {
		const { container } = render(Page, { props: { data } });
		const inputs = container.querySelectorAll('input');
		expect((inputs[0] as HTMLInputElement).value).toBe('Hello');
		expect((container.querySelector('textarea') as HTMLTextAreaElement).value).toBe('body text');
	});

	it('Delete post: confirm + DELETE + navigate to /admin/posts', async () => {
		vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		const locationStub = { href: '/admin/posts/hello' };
		vi.stubGlobal('location', locationStub);

		const { getByRole } = render(Page, { props: { data } });
		await fireEvent.click(getByRole('button', { name: 'Delete post' }));
		await Promise.resolve();
		await Promise.resolve();
		expect(fetchMock).toHaveBeenCalledWith('/api/post/hello', { method: 'DELETE' });
		expect(locationStub.href).toBe('/admin/posts');
	});

	it('Delete post: when confirm returns false, no fetch and no navigation', async () => {
		vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const locationStub = { href: '/admin/posts/hello' };
		vi.stubGlobal('location', locationStub);

		const { getByRole } = render(Page, { props: { data } });
		await fireEvent.click(getByRole('button', { name: 'Delete post' }));
		expect(fetchMock).not.toHaveBeenCalled();
		expect(locationStub.href).toBe('/admin/posts/hello');
	});
});
