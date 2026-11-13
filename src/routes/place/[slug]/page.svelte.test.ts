import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';

vi.mock('$app/state', () => ({ page: { data: { admin: false } } }));

import Page from './+page.svelte';

const SITE = 'https://compostmodernism.org';
const lisbon = { name: 'Lisbon, Portugal', slug: 'lisbon-portugal' };

afterEach(cleanup);

describe('place page', () => {
	it('renders the place name as h1 and its posts', () => {
		const { container } = render(Page, {
			props: {
				data: {
					siteUrl: SITE,
					place: lisbon,
					feed: [
						{
							slug: 'a',
							body: 'pastéis for breakfast',
							title: null,
							url: null,
							date: Date.UTC(2026, 0, 15),
							tags: [],
							place: lisbon,
							permalink: '/2026/01/15/a'
						}
					]
				}
			}
		});
		expect(container.querySelector('h1')?.textContent).toBe('Lisbon, Portugal');
		expect(container.querySelector('article')?.textContent).toContain('pastéis for breakfast');
	});
});
