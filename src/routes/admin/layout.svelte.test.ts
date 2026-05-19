import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Layout from './+layout.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

function childSnippet(text: string) {
	return createRawSnippet(() => ({ render: () => `<p data-testid="child">${text}</p>` }));
}

describe('admin layout', () => {
	it('renders AdminNav when authed', () => {
		const { container, getByText } = render(Layout, {
			props: { data: { authed: true }, children: childSnippet('hi') }
		});
		expect(container.querySelector('.admin-nav')).not.toBeNull();
		expect(getByText('hi')).not.toBeNull();
	});

	it('hides AdminNav when not authed (login screen)', () => {
		const { container } = render(Layout, {
			props: { data: { authed: false }, children: childSnippet('hi') }
		});
		expect(container.querySelector('.admin-nav')).toBeNull();
	});
});
