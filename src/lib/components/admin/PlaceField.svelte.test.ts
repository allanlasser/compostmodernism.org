import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import PlaceField from './PlaceField.svelte';

afterEach(cleanup);

const nameInput = (c: HTMLElement) => c.querySelector('input[name="place"]') as HTMLInputElement;
const suggestions = (c: HTMLElement) =>
	[...c.querySelectorAll('datalist option')].map((o) => (o as HTMLOptionElement).value);

describe('PlaceField', () => {
	it('shows the initial name', () => {
		const { container } = render(PlaceField, { props: { initial: 'Lisbon, Portugal' } });
		expect(nameInput(container).value).toBe('Lisbon, Portugal');
	});

	it('offers known names as suggestions', () => {
		const { container } = render(PlaceField, {
			props: { places: ['A train somewhere', 'Cambridge, Massachusetts'] }
		});
		expect(suggestions(container)).toEqual(['A train somewhere', 'Cambridge, Massachusetts']);
	});
});
