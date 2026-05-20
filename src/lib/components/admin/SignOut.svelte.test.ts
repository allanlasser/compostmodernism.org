import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import SignOut from './SignOut.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('SignOut', () => {
	it('clicking Sign out calls DELETE /api/session and navigates home', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		const locationStub = { href: '/admin' };
		vi.stubGlobal('location', locationStub);

		const { getByRole } = render(SignOut);
		await fireEvent.click(getByRole('button', { name: 'Sign out' }));

		expect(fetchMock).toHaveBeenCalledWith('/api/session', { method: 'DELETE' });
		expect(locationStub.href).toBe('/');
	});
});
