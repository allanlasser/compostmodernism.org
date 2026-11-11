import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/svelte';

import Page from './+page.svelte';

const SITE = 'https://compostmodernism.org';

function item(slug: string) {
	return {
		slug,
		body: `body of ${slug}`,
		title: null,
		url: null,
		date: Date.UTC(2026, 0, 15),
		tags: [],
		permalink: `/2026/01/15/${slug}`
	};
}

class FakeObserver {
	static instances: FakeObserver[] = [];
	disconnected = false;
	constructor(public cb: (entries: { isIntersecting: boolean }[]) => void) {
		FakeObserver.instances.push(this);
	}
	observe() {}
	unobserve() {}
	disconnect() {
		this.disconnected = true;
	}
}

function intersect() {
	const live = FakeObserver.instances.filter((o) => !o.disconnected);
	live[live.length - 1].cb([{ isIntersecting: true }]);
}

function respond(posts: string[], nextOffset: number | null) {
	return { ok: true, json: async () => ({ posts: posts.map(item), nextOffset }) };
}

function renderPage(slugs: string[], nextOffset: number | null) {
	return render(Page, {
		props: { data: { siteUrl: SITE, feed: slugs.map(item), nextOffset } }
	});
}

const slugsOf = (c: HTMLElement) =>
	[...c.querySelectorAll('.post')].map((el) => el.textContent?.match(/body of (\w+)/)?.[1]);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	FakeObserver.instances = [];
	fetchMock = vi.fn();
	vi.stubGlobal('fetch', fetchMock);
	vi.stubGlobal('IntersectionObserver', FakeObserver);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('home feed infinite scroll', () => {
	it('renders no sentinel and observes nothing when nextOffset is null', () => {
		const { container } = renderPage(['a', 'b'], null);
		expect(container.querySelector('.feed-more')).toBeNull();
		expect(FakeObserver.instances).toHaveLength(0);
	});

	it('does not fetch until the sentinel intersects', () => {
		const { container } = renderPage(['a', 'b'], 2);
		expect(container.querySelector('.feed-more')).not.toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('fetches the next page at nextOffset and appends in order', async () => {
		fetchMock.mockResolvedValue(respond(['c', 'd'], null));
		const { container } = renderPage(['a', 'b'], 2);
		intersect();
		await waitFor(() => expect(slugsOf(container)).toEqual(['a', 'b', 'c', 'd']));
		expect(fetchMock).toHaveBeenCalledWith('/api/feed?offset=2');
	});

	it('does not render a slug twice when the server repeats one', async () => {
		fetchMock.mockResolvedValue(respond(['b', 'c'], null));
		const { container } = renderPage(['a', 'b'], 2);
		intersect();
		await waitFor(() => expect(slugsOf(container)).toEqual(['a', 'b', 'c']));
	});

	it('does not start a second request while one is in flight', async () => {
		let resolve!: (v: unknown) => void;
		fetchMock.mockReturnValue(new Promise((r) => (resolve = r)));
		renderPage(['a'], 1);
		intersect();
		intersect();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		resolve(respond(['b'], null));
	});

	it('keeps loading while the sentinel stays visible, then stops at the end', async () => {
		fetchMock
			.mockResolvedValueOnce(respond(['b'], 2))
			.mockResolvedValueOnce(respond(['c'], null));
		const { container } = renderPage(['a'], 1);
		intersect();
		await waitFor(() => expect(slugsOf(container)).toEqual(['a', 'b']));
		intersect();
		await waitFor(() => expect(slugsOf(container)).toEqual(['a', 'b', 'c']));
		expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/feed?offset=2');
		await waitFor(() => expect(container.querySelector('.feed-more')).toBeNull());
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('shows Retry after a failure and does not refetch on its own', async () => {
		fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
		const { container, findByRole } = renderPage(['a'], 1);
		intersect();
		const retry = await findByRole('button', { name: /retry/i });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		fetchMock.mockResolvedValue(respond(['b'], null));
		await fireEvent.click(retry);
		await waitFor(() => expect(slugsOf(container)).toEqual(['a', 'b']));
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('treats a rejected fetch like a failure', async () => {
		fetchMock.mockRejectedValue(new Error('offline'));
		const { findByRole } = renderPage(['a'], 1);
		intersect();
		expect(await findByRole('button', { name: /retry/i })).toBeTruthy();
	});
});
