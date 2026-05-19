import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';

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

	it('admin=false: no Edit button in rail', () => {
		const { container } = render(Page, {
			props: { data: { post: post({ title: 'Hi' }) } }
		});
		expect(container.querySelector('.rail-edit')).toBeNull();
	});

	it('admin=true: rail shows Edit; clicking it swaps body for PostForm', async () => {
		pageState.data.admin = true;
		const { container, getByRole } = render(Page, {
			props: { data: { post: post({ title: 'Hi', body: 'hello' }) } }
		});
		expect(container.querySelector('.rail-edit')).not.toBeNull();
		await fireEvent.click(getByRole('button', { name: 'Edit' }));
		expect(container.querySelector('form.post-form')).not.toBeNull();
		expect(container.querySelector('h1')).toBeNull();
	});

	it('admin=true read mode: Edit sits next to the dateline, TagList below', () => {
		pageState.data.admin = true;
		const { container } = render(Page, {
			props: { data: { post: post({ title: 'Hi', tags: [{ name: 't', slug: 't' }] }) } }
		});
		const head = container.querySelector('.rail .rail-head');
		expect(head).not.toBeNull();
		expect(head?.querySelector('time')).not.toBeNull();
		expect(head?.querySelector('button.rail-edit')).not.toBeNull();
		const taglist = container.querySelector('.rail ul');
		if (taglist) expect(head?.contains(taglist)).toBe(false);
	});

	it('admin=true edit mode: rail hides Dateline/Taglist, shows Save/Cancel/Insert image', async () => {
		pageState.data.admin = true;
		const { container, getByRole } = render(Page, {
			props: { data: { post: post({ title: 'Hi', tags: [{ name: 't', slug: 't' }] }) } }
		});
		await fireEvent.click(getByRole('button', { name: 'Edit' }));
		const rail = container.querySelector('.rail') as HTMLElement;
		expect(rail.querySelector('time')).toBeNull();
		expect(rail.querySelector('ul')).toBeNull();
		expect(rail.querySelector('button[type="submit"]')).not.toBeNull();
		expect(rail.querySelector('button.cancel')).not.toBeNull();
		expect(rail.querySelector('button.insert-image')).not.toBeNull();
	});

	it('Cancel in the rail returns to the read view', async () => {
		pageState.data.admin = true;
		const { container, getByRole } = render(Page, {
			props: { data: { post: post({ title: 'Hi' }) } }
		});
		await fireEvent.click(getByRole('button', { name: 'Edit' }));
		await fireEvent.click(getByRole('button', { name: 'Cancel' }));
		expect(container.querySelector('form.post-form')).toBeNull();
		expect(container.querySelector('h1')?.textContent).toBe('Hi');
	});
});
