import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
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

afterEach(cleanup);

describe('single-post page', () => {
	it('link post → <h1> with external link', () => {
		const { container } = render(Page, {
			props: { data: { post: post({ title: 'DF', url: 'https://daringfireball.net' }) } }
		});
		const link = container.querySelector('h1 a') as HTMLAnchorElement;
		expect(link.getAttribute('href')).toBe('https://daringfireball.net');
		expect(link.getAttribute('target')).toBe('_blank');
	});

	it('titled post → <h1> with no link', () => {
		const { container } = render(Page, {
			props: { data: { post: post({ title: 'Hello' }) } }
		});
		const h1 = container.querySelector('h1');
		expect(h1?.textContent).toBe('Hello');
		expect(h1?.querySelector('a')).toBeNull();
	});

	it('plain post → no heading', () => {
		const { container } = render(Page, {
			props: { data: { post: post({ body: 'just text' }) } }
		});
		expect(container.querySelector('h1')).toBeNull();
		expect(container.querySelector('p')?.textContent).toBe('just text');
	});
});
