import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';

import Page from './+page.svelte';

interface FeedItem {
	slug: string;
	body: string;
	title: string | null;
	url: string | null;
	date: number;
	tags: { name: string; slug: string }[];
	permalink: string;
}

function item(over: Partial<FeedItem> = {}): FeedItem {
	return {
		slug: 'x',
		body: 'body text',
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
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('feed page', () => {
	it('link post — external <a> on title with ➻ marker', () => {
		const { container } = render(Page, {
			props: {
				data: {
					feed: [item({ title: 'DF', url: 'https://daringfireball.net', body: 'cool' })]
				}
			}
		});
		const link = container.querySelector('.post--link h2 a') as HTMLAnchorElement;
		expect(link.getAttribute('href')).toBe('https://daringfireball.net');
		expect(link.getAttribute('target')).toBe('_blank');
		expect(link.getAttribute('rel')).toContain('noopener');
		expect(container.querySelector('.post--link h2 a .link-marker')?.textContent).toBe('➻');
	});

	it('titled post — h2 with no external link', () => {
		const { container } = render(Page, {
			props: { data: { feed: [item({ title: 'Hello', body: 'body' })] } }
		});
		const h2 = container.querySelector('.post--titled h2');
		expect(h2?.textContent).toBe('Hello');
		expect(h2?.querySelector('a')).toBeNull();
	});

	it('plain post — body only, no heading', () => {
		const { container } = render(Page, {
			props: { data: { feed: [item({ body: 'just text' })] } }
		});
		const article = container.querySelector('.post--plain');
		expect(article).not.toBeNull();
		expect(article?.querySelector('h2')).toBeNull();
		expect(article?.querySelector('p')?.textContent).toBe('just text');
	});

	it('tags render as /tag/[slug] links', () => {
		const { container } = render(Page, {
			props: {
				data: {
					feed: [
						item({
							tags: [
								{ name: 'Food', slug: 'food' },
								{ name: 'Travel', slug: 'travel' }
							]
						})
					]
				}
			}
		});
		const tagLinks = Array.from(container.querySelectorAll('.tags a')) as HTMLAnchorElement[];
		expect(tagLinks.map((a) => a.getAttribute('href'))).toEqual(['/tag/food', '/tag/travel']);
		expect(tagLinks.map((a) => a.textContent)).toEqual(['Food', 'Travel']);
	});

	it('permalink renders as <time> wrapped in link', () => {
		const { container } = render(Page, {
			props: { data: { feed: [item({ permalink: '/2026/01/15/x' })] } }
		});
		const link = container.querySelector('a.permalink') as HTMLAnchorElement;
		expect(link.getAttribute('href')).toBe('/2026/01/15/x');
		expect(link.querySelector('time')).not.toBeNull();
	});
});
