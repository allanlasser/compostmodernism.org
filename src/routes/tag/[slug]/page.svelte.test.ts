import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Page from './+page.svelte';

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
		const { container } = render(Page, { props: { data: { tag: 'food', feed: [] } } });
		expect(container.querySelector('h1')?.textContent).toContain('food');
	});

	it('renders posts for the tag', () => {
		const { container } = render(Page, {
			props: {
				data: {
					tag: 'food',
					feed: [feedItem({ title: 'Soup' }), feedItem({ slug: 'b', title: 'Salad' })]
				}
			}
		});
		const titles = Array.from(container.querySelectorAll('article h2')).map((h) => h.textContent);
		expect(titles).toEqual(['Soup', 'Salad']);
	});

	it('empty feed → still renders heading, no articles', () => {
		const { container } = render(Page, { props: { data: { tag: 'orphan', feed: [] } } });
		expect(container.querySelector('h1')?.textContent).toContain('orphan');
		expect(container.querySelectorAll('article').length).toBe(0);
	});
});
