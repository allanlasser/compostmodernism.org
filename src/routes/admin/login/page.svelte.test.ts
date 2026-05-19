import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import Page from './+page.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('admin login page', () => {
	it('renders a password input and Sign in button', () => {
		const { container, getByRole } = render(Page);
		expect(container.querySelector('input[type="password"]')).not.toBeNull();
		expect(getByRole('button', { name: 'Sign in' })).not.toBeNull();
	});

	it('submitting the form POSTs to /api/session and navigates on success', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		const locationStub = { href: '/admin/login' };
		vi.stubGlobal('location', locationStub);

		const { container, getByRole } = render(Page);
		const password = container.querySelector('input[type="password"]') as HTMLInputElement;
		await fireEvent.input(password, { target: { value: 'correct-horse' } });
		await fireEvent.click(getByRole('button', { name: 'Sign in' }));

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/session',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ password: 'correct-horse' })
			})
		);
		expect(locationStub.href).toBe('/admin');
	});

	it('shows an error and clears the field on 401', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
		vi.stubGlobal('fetch', fetchMock);
		vi.stubGlobal('location', { href: '/admin/login' });

		const { container, getByRole, findByText } = render(Page);
		const password = container.querySelector('input[type="password"]') as HTMLInputElement;
		await fireEvent.input(password, { target: { value: 'wrong' } });
		await fireEvent.click(getByRole('button', { name: 'Sign in' }));

		expect(await findByText('Incorrect password')).not.toBeNull();
		expect(password.value).toBe('');
	});
});
