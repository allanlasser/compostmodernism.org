import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import FeedItem from './FeedItem.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function item(
	over: Partial<{
		slug: string;
		body: string;
		title: string | null;
		url: string | null;
		tags: { name: string; slug: string }[];
	}> = {}
) {
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

describe('FeedItem admin behavior', () => {
	it('admin=false: no Edit button in rail, body renders normally', () => {
		const { container, queryByRole } = render(FeedItem, { props: { item: item() } });
		expect(queryByRole('button', { name: 'Edit' })).toBeNull();
		expect(container.querySelector('.body')).not.toBeNull();
		expect(container.querySelector('form.post-form')).toBeNull();
	});

	it('admin=true read mode: Edit sits next to the permalink dateline, TagList below', () => {
		const { container } = render(FeedItem, { props: { item: item(), admin: true } });
		const head = container.querySelector('.rail .rail-head');
		expect(head).not.toBeNull();
		// Both the permalink-wrapped Dateline and the Edit button are children of rail-head
		expect(head?.querySelector('a.permalink time')).not.toBeNull();
		expect(head?.querySelector('button.rail-edit')).not.toBeNull();
		// TagList is a sibling, not nested inside rail-head
		const taglist = container.querySelector('.rail .tag-list, .rail ul');
		if (taglist) expect(head?.contains(taglist)).toBe(false);
	});

	it('admin=true edit mode: rail hides Dateline and TagList, shows Save / Cancel / Insert image', async () => {
		const { container, getByRole } = render(FeedItem, {
			props: { item: item(), admin: true }
		});
		await fireEvent.click(getByRole('button', { name: 'Edit' }));

		const rail = container.querySelector('.rail') as HTMLElement;
		expect(rail.querySelector('a.permalink')).toBeNull();
		expect(rail.querySelector('.tag-list, ul')).toBeNull();
		expect(rail.querySelector('button[type="submit"]')).not.toBeNull();
		expect(rail.querySelector('button.cancel')).not.toBeNull();
		expect(rail.querySelector('button.insert-image')).not.toBeNull();
	});

	it('rail Save button references the form via the form attribute', async () => {
		const { container, getByRole } = render(FeedItem, {
			props: { item: item(), admin: true }
		});
		await fireEvent.click(getByRole('button', { name: 'Edit' }));

		const form = container.querySelector('form.post-form') as HTMLFormElement;
		const railSubmit = container.querySelector('.rail button[type="submit"]') as HTMLButtonElement;
		expect(form.id).toBeTruthy();
		expect(railSubmit.getAttribute('form')).toBe(form.id);
	});

	it('clicking Edit swaps the read view for a PostForm', async () => {
		const { container, getByRole } = render(FeedItem, {
			props: { item: item(), admin: true }
		});
		expect(container.querySelector('form.post-form')).toBeNull();
		await fireEvent.click(getByRole('button', { name: 'Edit' }));
		expect(container.querySelector('form.post-form')).not.toBeNull();
		expect(container.querySelector('.body')).toBeNull();
	});

	it('Cancel in the rail returns to the read view', async () => {
		const { container, getByRole } = render(FeedItem, {
			props: { item: item(), admin: true }
		});
		await fireEvent.click(getByRole('button', { name: 'Edit' }));
		expect(container.querySelector('form.post-form')).not.toBeNull();
		await fireEvent.click(getByRole('button', { name: 'Cancel' }));
		expect(container.querySelector('form.post-form')).toBeNull();
		expect(container.querySelector('.body')).not.toBeNull();
	});

	it('Save updates the rendered body without a round-trip', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);
		vi.stubGlobal('fetch', fetchMock);

		const { container, getByRole } = render(FeedItem, {
			props: { item: item({ body: 'original body' }), admin: true }
		});
		await fireEvent.click(getByRole('button', { name: 'Edit' }));
		const bodyTextarea = container.querySelector('textarea') as HTMLTextAreaElement;
		await fireEvent.input(bodyTextarea, { target: { value: 'updated body' } });
		await fireEvent.click(getByRole('button', { name: 'Save' }));

		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(container.querySelector('form.post-form')).toBeNull();
		expect(container.querySelector('.body')?.textContent).toContain('updated body');
	});

	it('rail Insert image opens the upload modal', async () => {
		const { container, getByRole } = render(FeedItem, {
			props: { item: item(), admin: true }
		});
		await fireEvent.click(getByRole('button', { name: 'Edit' }));
		expect(container.querySelector('.upload-modal, [role="dialog"]')).toBeNull();
		await fireEvent.click(getByRole('button', { name: 'Insert image' }));
		expect(container.querySelector('.upload-modal, [role="dialog"]')).not.toBeNull();
	});
});
