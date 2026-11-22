import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import PostsTable from './PostsTable.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

type Preview = { image: { src: string; alt: string } | null; text: string };

function row(over: Partial<{ slug: string; title: string | null; body: string; preview: Preview; tags: { name: string; slug: string }[]; permalink: string; date: number }> = {}) {
	return {
		slug: 'hello',
		title: 'Hello',
		body: 'body',
		preview: { image: null, text: 'body' } as Preview,
		tags: [],
		permalink: '/2026/01/15/hello',
		date: Date.UTC(2026, 0, 15),
		...over
	};
}

describe('PostsTable', () => {
	it('renders one row per post with title linking to /admin/posts/[slug]', () => {
		const { container } = render(PostsTable, {
			props: { posts: [row({ slug: 'a' }), row({ slug: 'b' })] }
		});
		const tbodyRows = container.querySelectorAll('tbody tr');
		expect(tbodyRows.length).toBe(2);
		expect(container.querySelector('a[href="/admin/posts/a"]')).not.toBeNull();
		expect(container.querySelector('a[href="/admin/posts/b"]')).not.toBeNull();
	});

	it('shows the preview text when title is null', () => {
		const { container } = render(PostsTable, {
			props: { posts: [row({ title: null, preview: { image: null, text: 'plain prose preview' } })] }
		});
		expect(container.textContent).toContain('plain prose preview');
	});

	it('renders the leading image as a thumbnail inside the row link', () => {
		const { container } = render(PostsTable, {
			props: {
				posts: [
					row({
						slug: 'pic',
						title: null,
						preview: { image: { src: 'https://static.example/a.jpg', alt: 'A spider' }, text: 'In the garden' }
					})
				]
			}
		});
		const img = container.querySelector('a[href="/admin/posts/pic"] img');
		expect(img?.getAttribute('src')).toBe('https://static.example/a.jpg');
		expect(img?.getAttribute('alt')).toBe('A spider');
		expect(container.textContent).toContain('In the garden');
	});

	it('shows empty state when posts is empty', () => {
		const { getByText } = render(PostsTable, { props: { posts: [] } });
		expect(getByText('No posts yet.')).not.toBeNull();
	});
});
