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

	it('does not render Admin link when data.admin is false', () => {
		const { container } = render(Layout, {
			props: { data: { admin: false }, children: emptyChildren }
		});
		expect(container.querySelector('a[href="/admin"]')).toBeNull();
	});

	it('does not render Admin link when data.admin is missing', () => {
		const { container } = render(Layout, {
			props: { data: {}, children: emptyChildren }
		});
		expect(container.querySelector('a[href="/admin"]')).toBeNull();
	});
});
