import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import FeedItem from './FeedItem.svelte';
import type { Post } from '$lib/types';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function item(over: Partial<Post> = {}): Post {
	return {
		slug: 'hello',
		body: 'body text',
		title: 'Hello',
		url: null,
		date: Date.UTC(2026, 0, 15),
		tags: [{ name: 'food', slug: 'food' }],
		permalink: '/2026/01/15/hello',
		...over
	};
}

describe('FeedItem', () => {
	it('link post: external <a> on the heading with the link marker', () => {
		const { container } = render(FeedItem, {
			props: { item: item({ title: 'DF', url: 'https://daringfireball.net' }) }
		});
		const link = container.querySelector('.post--link h2 a') as HTMLAnchorElement;
		expect(link.getAttribute('href')).toBe('https://daringfireball.net');
		expect(link.getAttribute('target')).toBe('_blank');
		expect(link.getAttribute('rel')).toContain('noopener');
		expect(link.querySelector('.link-marker')?.textContent).toBe('➻');
	});

	it('titled post: heading without an external link', () => {
		const { container } = render(FeedItem, {
			props: { item: item({ title: 'Hello', url: null }) }
		});
		const h2 = container.querySelector('.post--titled h2');
		expect(h2?.textContent?.trim()).toBe('Hello');
		expect(h2?.querySelector('a')).toBeNull();
	});

	it('plain post: no heading, body only', () => {
		const { container } = render(FeedItem, {
			props: { item: item({ title: null, url: null, body: 'just text' }) }
		});
		expect(container.querySelector('.post--plain')).not.toBeNull();
		expect(container.querySelector('.post--plain h2')).toBeNull();
		expect(container.querySelector('.post--plain p')?.textContent).toBe('just text');
	});

	it('rail: renders permalink-wrapped <time> and tag links', () => {
		const { container } = render(FeedItem, {
			props: {
				item: item({
					permalink: '/2026/01/15/hello',
					tags: [
						{ name: 'Food', slug: 'food' },
						{ name: 'Travel', slug: 'travel' }
					]
				})
			}
		});
		const permalink = container.querySelector('a.permalink') as HTMLAnchorElement;
		expect(permalink.getAttribute('href')).toBe('/2026/01/15/hello');
		expect(permalink.querySelector('time')).not.toBeNull();
		const tagHrefs = Array.from(container.querySelectorAll('.rail a[href^="/tag/"]')).map((a) =>
			a.getAttribute('href')
		);
		expect(tagHrefs).toEqual(['/tag/food', '/tag/travel']);
	});

	it('lightbox: clicking a body <img> opens a dialog', async () => {
		const { container } = render(FeedItem, {
			props: {
				item: item({
					title: null,
					url: null,
					body: '![A loaf](https://images.test/x.webp)'
				})
			}
		});
		const img = container.querySelector('.body img') as HTMLImageElement;
		expect(img).not.toBeNull();
		expect(document.querySelector('[role="dialog"]')).toBeNull();
		await fireEvent.click(img);
		const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
		expect(dialog).not.toBeNull();
		expect(dialog.querySelector('img')?.getAttribute('src')).toBe('https://images.test/x.webp');
	});

	it('lightbox: on narrow screens, tapping a body <img> toggles is-tapped instead of opening a dialog', async () => {
		vi.stubGlobal('matchMedia', (query: string) => ({
			matches: query.includes('640'),
			media: query,
			addEventListener: () => {},
			removeEventListener: () => {},
			addListener: () => {},
			removeListener: () => {},
			dispatchEvent: () => false,
			onchange: null
		}));
		const { container } = render(FeedItem, {
			props: {
				item: item({
					title: null,
					url: null,
					body: '![A loaf](https://images.test/x.webp)'
				})
			}
		});
		const img = container.querySelector('.body img') as HTMLImageElement;
		await fireEvent.click(img);
		expect(document.querySelector('[role="dialog"]')).toBeNull();
		expect(img.classList.contains('is-tapped')).toBe(true);
		await fireEvent.click(img);
		expect(document.querySelector('[role="dialog"]')).toBeNull();
		expect(img.classList.contains('is-tapped')).toBe(false);
	});

	it('lightbox: clicking a body <img> nested in <a> does not open a dialog', async () => {
		const { container } = render(FeedItem, {
			props: {
				item: item({
					title: null,
					url: null,
					body: '[![A loaf](https://images.test/x.webp)](https://example.test/post)'
				})
			}
		});
		const img = container.querySelector('.body img') as HTMLImageElement;
		expect(img).not.toBeNull();
		expect(img.closest('a')).not.toBeNull();
		await fireEvent.click(img);
		expect(document.querySelector('[role="dialog"]')).toBeNull();
	});

	it('lightbox: pressing Escape closes the dialog', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		try {
			const { container } = render(FeedItem, {
				props: {
					item: item({
						title: null,
						url: null,
						body: '![A loaf](https://images.test/x.webp)'
					})
				}
			});
			const img = container.querySelector('.body img') as HTMLImageElement;
			await fireEvent.click(img);
			expect(document.querySelector('[role="dialog"]')).not.toBeNull();
			await fireEvent.keyDown(window, { key: 'Escape' });
			await vi.advanceTimersByTimeAsync(300);
			expect(document.querySelector('[role="dialog"]')).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it('rail snippet: when provided, renders inside the rail', () => {
		const railSnippet = createRawSnippet(() => ({
			render: () => '<div data-testid="extra-rail">EXTRA</div>'
		}));
		const { container } = render(FeedItem, {
			props: { item: item(), rail: railSnippet }
		});
		const extra = container.querySelector('.rail [data-testid="extra-rail"]');
		expect(extra).not.toBeNull();
		expect(extra?.textContent).toBe('EXTRA');
	});
});
