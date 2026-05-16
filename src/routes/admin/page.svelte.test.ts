import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import Page from './+page.svelte';

interface AdminPost {
	slug: string;
	body: string;
	title: string | null;
	url: string | null;
	date: number;
	tags: { name: string; slug: string }[];
	permalink: string;
}

function p(over: Partial<AdminPost> = {}): AdminPost {
	return {
		slug: 'hello',
		body: 'body text',
		title: 'Hello',
		url: null,
		date: Date.UTC(2026, 0, 15),
		tags: [],
		permalink: '/2026/01/15/hello',
		...over
	};
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('admin page', () => {
	it('data.posts absent → renders login form, no post list', () => {
		const { container } = render(Page, { props: { data: {} } });
		expect(container.querySelector('.admin--login')).not.toBeNull();
		expect(container.querySelector('input[type="password"]')).not.toBeNull();
		expect(container.querySelector('.admin-posts')).toBeNull();
	});

	it('data.posts present → renders post list, no login form', () => {
		const { container } = render(Page, { props: { data: { posts: [p()] } } });
		expect(container.querySelector('.admin--authenticated')).not.toBeNull();
		expect(container.querySelector('input[type="password"]')).toBeNull();
		expect(container.querySelector('.admin-posts')).not.toBeNull();
	});

	it('each post renders as <details> with title/body preview', () => {
		const { container } = render(Page, {
			props: {
				data: {
					posts: [
						p({ slug: 'a', title: 'First', body: 'b' }),
						p({ slug: 'b', title: null, body: 'plain body preview' })
					]
				}
			}
		});
		const items = container.querySelectorAll('details.admin-post');
		expect(items).toHaveLength(2);
		expect(items[0].querySelector('summary')?.textContent).toContain('First');
		expect(items[1].querySelector('summary')?.textContent).toContain('plain body preview');
	});

	it('image uploader section present when authenticated', () => {
		const { container } = render(Page, { props: { data: { posts: [] } } });
		expect(container.querySelector('.admin-upload')).not.toBeNull();
		expect(container.querySelector('.admin-upload input[type="file"]')).not.toBeNull();
	});

	it('clicking Save calls PATCH /api/post/[slug] with form field values', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		const { container } = render(Page, {
			props: {
				data: {
					posts: [
						p({
							slug: 'a',
							title: 'First',
							body: 'orig body',
							url: null,
							tags: [{ name: 'Food', slug: 'food' }]
						})
					]
				}
			}
		});

		const bodyField = container.querySelector('textarea[id="body-a"]') as HTMLTextAreaElement;
		await fireEvent.input(bodyField, { target: { value: 'new body' } });

		const saveBtn = container.querySelector('button.save') as HTMLButtonElement;
		await fireEvent.click(saveBtn);

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/post/a',
			expect.objectContaining({
				method: 'PATCH',
				headers: expect.objectContaining({ 'Content-Type': 'application/json' })
			})
		);
		const callBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
		expect(callBody).toMatchObject({
			body: 'new body',
			title: 'First',
			tags: ['Food']
		});
	});

	it('summary preview updates to the new title after a successful save', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		const { container } = render(Page, {
			props: { data: { posts: [p({ slug: 'a', title: 'Old', body: 'b' })] } }
		});

		const summary = container.querySelector('.admin-post__preview') as HTMLElement;
		expect(summary.textContent?.trim()).toBe('Old');

		const titleField = container.querySelector('input[id="title-a"]') as HTMLInputElement;
		await fireEvent.input(titleField, { target: { value: 'New' } });

		// Typing alone must NOT touch the summary — only a confirmed save does.
		expect(summary.textContent?.trim()).toBe('Old');

		await fireEvent.click(container.querySelector('button.save') as HTMLButtonElement);

		expect(summary.textContent?.trim()).toBe('New');
	});

	it('summary preview falls back to body slice after save when title is cleared', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		const { container } = render(Page, {
			props: { data: { posts: [p({ slug: 'a', title: 'Old', body: 'fresh body content' })] } }
		});

		const titleField = container.querySelector('input[id="title-a"]') as HTMLInputElement;
		await fireEvent.input(titleField, { target: { value: '' } });

		await fireEvent.click(container.querySelector('button.save') as HTMLButtonElement);

		const summary = container.querySelector('.admin-post__preview') as HTMLElement;
		expect(summary.textContent?.trim()).toBe('fresh body content');
	});

	it('summary preview stays unchanged when save fails (non-2xx)', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response('{"error":"x"}', { status: 500 }));
		vi.stubGlobal('fetch', fetchMock);

		const { container } = render(Page, {
			props: { data: { posts: [p({ slug: 'a', title: 'Old', body: 'b' })] } }
		});

		const titleField = container.querySelector('input[id="title-a"]') as HTMLInputElement;
		await fireEvent.input(titleField, { target: { value: 'Attempted' } });
		await fireEvent.click(container.querySelector('button.save') as HTMLButtonElement);

		const summary = container.querySelector('.admin-post__preview') as HTMLElement;
		expect(summary.textContent?.trim()).toBe('Old');
	});

	it('typed title survives a successful save (does not reset to data.posts value)', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		const { container } = render(Page, {
			props: { data: { posts: [p({ slug: 'a', title: null, body: 'b' })] } }
		});

		const titleField = container.querySelector('input[id="title-a"]') as HTMLInputElement;
		await fireEvent.input(titleField, { target: { value: 'My New Title' } });
		expect(titleField.value).toBe('My New Title');

		const saveBtn = container.querySelector('button.save') as HTMLButtonElement;
		await fireEvent.click(saveBtn);

		// After save resolves, saving/saved state changes triggered a re-render.
		// The title input must still show what the user typed.
		expect(titleField.value).toBe('My New Title');
	});

	it('successful save shows "Saved ✓" then reverts after 2s', async () => {
		vi.useFakeTimers();
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		const { container } = render(Page, {
			props: { data: { posts: [p({ slug: 'a' })] } }
		});

		const saveBtn = container.querySelector('button.save') as HTMLButtonElement;
		await fireEvent.click(saveBtn);
		await vi.advanceTimersByTimeAsync(0);

		expect(saveBtn.textContent).toMatch(/Saved/);

		await vi.advanceTimersByTimeAsync(2100);

		expect(saveBtn.textContent).not.toMatch(/Saved/);
	});
});
