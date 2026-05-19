import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Page from './+page.svelte';

afterEach(cleanup);

const post = {
	slug: 's',
	body: 'b',
	title: 'T',
	date: Date.UTC(2026, 0, 15),
	tags: [],
	permalink: '/2026/01/15/s'
};

describe('admin posts page', () => {
	it('renders a New post link and the posts table', () => {
		const { getByRole, container } = render(Page, {
			props: { data: { posts: [post], page: 1, perPage: 25, total: 1, totalPages: 1 } }
		});
		const link = getByRole('link', { name: '+ New post' });
		expect(link).toHaveProperty('href', expect.stringContaining('/admin/posts/new'));
		expect(container.querySelector('.posts-table')).not.toBeNull();
	});

	it('shows Page X of Y with Prev/Next links when totalPages > 1', () => {
		const { container, getByText } = render(Page, {
			props: { data: { posts: [post], page: 2, perPage: 25, total: 60, totalPages: 3 } }
		});
		expect(getByText(/Page 2 of 3/)).not.toBeNull();
		expect(container.querySelector('a[href="?page=1"]')).not.toBeNull();
		expect(container.querySelector('a[href="?page=3"]')).not.toBeNull();
	});

	it('disables Prev on the first page and Next on the last page', () => {
		const { container } = render(Page, {
			props: { data: { posts: [post], page: 1, perPage: 25, total: 30, totalPages: 2 } }
		});
		expect(container.querySelector('a[rel="prev"]')).toBeNull();
		expect(container.querySelector('a[rel="next"]')).not.toBeNull();
	});

	it('hides the pager entirely on a single-page result', () => {
		const { container } = render(Page, {
			props: { data: { posts: [post], page: 1, perPage: 25, total: 1, totalPages: 1 } }
		});
		expect(container.querySelector('.pager')).toBeNull();
	});
});
