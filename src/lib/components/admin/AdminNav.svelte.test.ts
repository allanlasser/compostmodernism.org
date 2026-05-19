import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import AdminNav from './AdminNav.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('AdminNav', () => {
	it('renders Posts and Images links', () => {
		const { getByRole } = render(AdminNav);
		expect(getByRole('link', { name: 'Posts' })).toHaveProperty('href', expect.stringContaining('/admin/posts'));
		expect(getByRole('link', { name: 'Images' })).toHaveProperty('href', expect.stringContaining('/admin/images'));
	});

	it('Sign out button calls DELETE /api/session and navigates to /admin/login', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		// jsdom-style location stub — happy-dom allows reassigning href.
		const locationStub = { href: '/admin' };
		vi.stubGlobal('location', locationStub);

		const { getByRole } = render(AdminNav);
		await fireEvent.click(getByRole('button', { name: 'Sign out' }));

		expect(fetchMock).toHaveBeenCalledWith('/api/session', { method: 'DELETE' });
		expect(locationStub.href).toBe('/admin/login');
	});
});
