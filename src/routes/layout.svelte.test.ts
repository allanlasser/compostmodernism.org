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

	it('renders subscribe links without a label', () => {
		const { container } = render(Layout, {
			props: { data: { admin: false }, children: emptyChildren }
		});
		expect(container.querySelector('a[href="https://buttondown.com/compostmodernism"]')).not.toBeNull();
		expect(container.querySelector('a[href="/feeds/posts.xml"]')).not.toBeNull();
		expect(container.querySelector('header')?.textContent).not.toContain('Subscribe');
	});

	it('renders admin links without a greeting', () => {
		const { container } = render(Layout, {
			props: { data: { admin: true }, children: emptyChildren }
		});
		expect(container.querySelector('header')?.textContent).not.toContain('Hi, Allan');
	});

	it('does not render Admin link when data.admin is missing', () => {
		const { container } = render(Layout, {
			props: { data: {}, children: emptyChildren }
		});
		expect(container.querySelector('a[href="/admin"]')).toBeNull();
	});
});
