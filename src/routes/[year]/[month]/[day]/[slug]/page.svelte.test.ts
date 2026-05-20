import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';

const pageState = vi.hoisted(() => ({ data: { admin: false } as { admin: boolean } }));
vi.mock('$app/state', () => ({ page: pageState }));

import Page from './+page.svelte';

interface SinglePost {
	slug: string;
	body: string;
	title: string | null;
	url: string | null;
	date: number;
	tags: { name: string; slug: string }[];
	permalink: string;
}

function post(over: Partial<SinglePost> = {}): SinglePost {
	return {
		slug: 'x',
		body: 'body',
		title: null,
		url: null,
		date: Date.UTC(2026, 0, 15),
		tags: [],
		permalink: '/2026/01/15/x',
		...over
	};
}

afterEach(() => {
	cleanup();
	pageState.data.admin = false;
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('single-post page', () => {
	it('link post → heading link points externally', () => {
		const { container } = render(Page, {
			props: { data: { post: post({ title: 'DF', url: 'https://daringfireball.net' }) } }
		});
		const link = container.querySelector('.post--link h2 a') as HTMLAnchorElement;
		expect(link.getAttribute('href')).toBe('https://daringfireball.net');
		expect(link.getAttribute('target')).toBe('_blank');
	});

	it('titled post → heading without an external link', () => {
		const { container } = render(Page, {
			props: { data: { post: post({ title: 'Hello' }) } }
		});
		const h2 = container.querySelector('.post--titled h2');
		expect(h2?.textContent?.trim()).toBe('Hello');
		expect(h2?.querySelector('a')).toBeNull();
	});

	it('plain post → no heading', () => {
		const { container } = render(Page, {
			props: { data: { post: post({ body: 'just text' }) } }
		});
		expect(container.querySelector('.post--plain h2')).toBeNull();
		expect(container.querySelector('.post--plain p')?.textContent).toBe('just text');
	});

	it('admin=false: rail does not include an Edit link', () => {
		const { container } = render(Page, {
			props: { data: { post: post({ title: 'Hi' }) } }
		});
		expect(container.querySelector('.admin-tools')).toBeNull();
	});

	it('admin=true: rail includes an Edit link to /admin/posts/[slug]', () => {
		pageState.data.admin = true;
		const { container } = render(Page, {
			props: { data: { post: post({ slug: 'hi', title: 'Hi' }) } }
		});
		const editLink = container.querySelector('.admin-tools a') as HTMLAnchorElement;
		expect(editLink).not.toBeNull();
		expect(editLink.getAttribute('href')).toBe('/admin/posts/hi');
		expect(editLink.textContent?.trim()).toBe('Edit');
	});
});
