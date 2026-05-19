import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import PostsTable from './PostsTable.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function row(over: Partial<{ slug: string; title: string | null; body: string; tags: { name: string; slug: string }[]; permalink: string; date: number }> = {}) {
	return {
		slug: 'hello',
		title: 'Hello',
		body: 'body',
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

	it('falls back to body preview when title is null', () => {
		const { container } = render(PostsTable, {
			props: { posts: [row({ title: null, body: 'plain prose preview' })] }
		});
		expect(container.textContent).toContain('plain prose preview');
	});

	it('truncates long body previews', () => {
		const long = 'a'.repeat(200);
		const { container } = render(PostsTable, {
			props: { posts: [row({ title: null, body: long })] }
		});
		expect(container.textContent).toContain('…');
	});

	it('shows empty state when posts is empty', () => {
		const { getByText } = render(PostsTable, { props: { posts: [] } });
		expect(getByText('No posts yet.')).not.toBeNull();
	});
});
