import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import AdminNav from './AdminNav.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('AdminNav', () => {
	it('renders Posts and Images links', () => {
		const { getByRole } = render(AdminNav);
		expect(getByRole('link', { name: 'Posts' })).toHaveProperty(
			'href',
			expect.stringContaining('/admin/posts')
		);
		expect(getByRole('link', { name: 'Images' })).toHaveProperty(
			'href',
			expect.stringContaining('/admin/images')
		);
	});
});
