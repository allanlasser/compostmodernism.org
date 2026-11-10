import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';

vi.mock('$app/state', () => ({ page: { data: { admin: false } } }));

import Page from './+page.svelte';

const SITE = 'https://compostmodernism.org';

const ts = Date.UTC(2026, 0, 15);
function feedItem(over: Partial<{ slug: string; body: string; title: string | null }> = {}) {
	return {
		slug: 'a',
		body: 'b',
		title: null,
		url: null,
		date: ts,
		tags: [],
		permalink: '/2026/01/15/a',
		...over
	};
}

afterEach(cleanup);

describe('tag page', () => {
	it('renders tag name as h1', () => {
		const { container } = render(Page, { props: { data: { siteUrl: SITE, tag: 'food', feed: [] } } });
		expect(container.querySelector('h1')?.textContent).toContain('food');
	});

	it('renders posts for the tag', () => {
		const { container } = render(Page, {
			props: {
				data: {
					siteUrl: SITE,
					tag: 'food',
					feed: [feedItem({ title: 'Soup' }), feedItem({ slug: 'b', title: 'Salad' })]
				}
			}
		});
		const titles = Array.from(container.querySelectorAll('article h2')).map((h) => h.textContent);
		expect(titles).toEqual(['Soup', 'Salad']);
	});

	it('empty feed → still renders heading, no articles', () => {
		const { container } = render(Page, { props: { data: { siteUrl: SITE, tag: 'orphan', feed: [] } } });
		expect(container.querySelector('h1')?.textContent).toContain('orphan');
		expect(container.querySelectorAll('article').length).toBe(0);
	});

	it('renders tag preview tags at the tag url', () => {
		render(Page, { props: { data: { siteUrl: SITE, tag: 'food', feed: [] } } });
		expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('#food');
		expect(document.head.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe('https://compostmodernism.org/tag/food');
	});
});
