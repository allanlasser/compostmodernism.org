import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';

const pageState = vi.hoisted(() => ({ data: { admin: false } as { admin: boolean } }));
vi.mock('$app/state', () => ({ page: pageState }));

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
	pageState.data.admin = false;
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

	it('admin=false: no + New post toggle', () => {
		const { queryByRole } = render(Page, {
			props: { data: { feed: [item()] } }
		});
		expect(queryByRole('button', { name: '+ New post' })).toBeNull();
	});

	it('admin=true: shows + New post toggle above the feed', () => {
		pageState.data.admin = true;
		const { getByRole } = render(Page, {
			props: { data: { feed: [item()] } }
		});
		expect(getByRole('button', { name: '+ New post' })).not.toBeNull();
	});

	it('clicking + New post reveals an inline PostForm; Cancel hides it', async () => {
		pageState.data.admin = true;
		const { container, getByRole } = render(Page, {
			props: { data: { feed: [item()] } }
		});
		await fireEvent.click(getByRole('button', { name: '+ New post' }));
		expect(container.querySelector('article.post--compose form.post-form')).not.toBeNull();
		await fireEvent.click(getByRole('button', { name: 'Cancel' }));
		expect(container.querySelector('article.post--compose')).toBeNull();
		expect(getByRole('button', { name: '+ New post' })).not.toBeNull();
	});

	it('on successful POST, prepends the new post to the feed and closes the composer', async () => {
		pageState.data.admin = true;
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ ok: true, slug: 'brand-new' }), {
				status: 201,
				headers: { 'Content-Type': 'application/json' }
			})
		);
		vi.stubGlobal('fetch', fetchMock);

		const { container, getByRole } = render(Page, {
			props: { data: { feed: [item({ slug: 'old', title: 'Old', body: 'old body' })] } }
		});

		await fireEvent.click(getByRole('button', { name: '+ New post' }));
		const titleInput = container.querySelectorAll('input')[0] as HTMLInputElement;
		const bodyTextarea = container.querySelector('textarea') as HTMLTextAreaElement;
		await fireEvent.input(titleInput, { target: { value: 'Fresh' } });
		await fireEvent.input(bodyTextarea, { target: { value: 'fresh body' } });
		await fireEvent.click(getByRole('button', { name: 'Post' }));

		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		// Composer is gone.
		expect(container.querySelector('article.post--compose')).toBeNull();

		// Two posts in the feed; the new one is first.
		const articles = container.querySelectorAll('article.post');
		expect(articles.length).toBe(2);
		const firstHeading = articles[0].querySelector('h2');
		expect(firstHeading?.textContent?.trim()).toBe('Fresh');
	});
});
