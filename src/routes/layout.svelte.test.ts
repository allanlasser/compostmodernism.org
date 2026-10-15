import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Layout from './+layout.svelte';
import { createRawSnippet } from 'svelte';

const emptyChildren = createRawSnippet(() => ({
	render: () => '<div></div>'
}));

afterEach(cleanup);

describe('root layout', () => {
	it('renders Admin link when data.admin is true', () => {
		const { container } = render(Layout, {
			props: { data: { admin: true }, children: emptyChildren }
		});
		const link = container.querySelector('a[href="/admin"]') as HTMLAnchorElement;
		expect(link).not.toBeNull();
		expect(link.textContent?.trim()).toBe('Admin');
	});

	it('renders newsletter and RSS subscribe links', () => {
		const { container } = render(Layout, {
			props: { data: { admin: false }, children: emptyChildren }
		});
		const newsletter = container.querySelector('a[href="https://buttondown.com/compostmodernism"]');
		expect(newsletter?.textContent?.trim()).toBe('Newsletter');
		expect(container.querySelector('a[href="/feeds/posts.xml"]')).not.toBeNull();
	});

	it('matches the header snapshot for visitors', () => {
		const { container } = render(Layout, {
			props: { data: { admin: false }, children: emptyChildren }
		});
		expect(container.querySelector('header')).toMatchSnapshot();
	});

	it('matches the header snapshot for admins', () => {
		const { container } = render(Layout, {
			props: { data: { admin: true }, children: emptyChildren }
		});
		expect(container.querySelector('header')).toMatchSnapshot();
	});
});
