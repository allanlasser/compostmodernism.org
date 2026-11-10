import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';

const pageState = vi.hoisted(() => ({
	status: 404,
	error: { message: 'Post not found' } as { message: string } | null
}));
vi.mock('$app/state', () => ({ page: pageState }));

import ErrorPage from './+error.svelte';

afterEach(cleanup);

describe('error page', () => {
	it('titles a 404 as not found and shows the message', () => {
		pageState.status = 404;
		pageState.error = { message: 'Post not found' };
		const { container } = render(ErrorPage);
		expect(document.title).toBe('Not found · compostmodernism');
		expect(container.querySelector('h1')?.textContent).toBe('Post not found');
		expect(container.querySelector('a[href="/"]')).not.toBeNull();
	});

	it('titles other errors generically', () => {
		pageState.status = 500;
		pageState.error = { message: 'Internal Error' };
		render(ErrorPage);
		expect(document.title).toBe('Something went wrong · compostmodernism');
	});
});
