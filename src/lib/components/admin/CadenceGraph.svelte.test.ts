import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import CadenceGraph from './CadenceGraph.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe('CadenceGraph', () => {
	it('starts scrolled to the most recent week', () => {
		vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(900);
		const { container } = render(CadenceGraph, {
			props: { cadence: [{ date: '2025-01-06', count: 1 }] }
		});
		const wrap = container.querySelector('.cadence-wrap') as HTMLElement;
		expect(wrap.scrollLeft).toBe(900);
	});
});
