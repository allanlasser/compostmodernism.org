import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/svelte';
import PlaceField from './PlaceField.svelte';
import type { AdminPlace } from '$lib/types';

const home: AdminPlace = { id: 1, name: 'Home', slug: 'home', latitude: 42.3736, longitude: -71.1097, count: 9 };
const lisbon: AdminPlace = { id: 2, name: 'Lisbon', slug: 'lisbon', latitude: 38.7223, longitude: -9.1393, count: 2 };

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function stubGeolocation(latitude: number, longitude: number) {
	Object.defineProperty(navigator, 'geolocation', {
		configurable: true,
		value: {
			getCurrentPosition: (ok: PositionCallback) =>
				ok({ coords: { latitude, longitude } } as GeolocationPosition)
		}
	});
}

function stubNominatim(address: Record<string, string>) {
	const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ address }), { status: 200 }));
	vi.stubGlobal('fetch', mock);
	return mock;
}

function optionLabels(container: HTMLElement) {
	return [...container.querySelectorAll('option')].map((o) => o.textContent?.trim());
}

describe('PlaceField', () => {
	it('selects the initial place by slug', () => {
		const { container } = render(PlaceField, { props: { places: [home, lisbon], initialSlug: 'lisbon' } });
		expect((container.querySelector('select') as HTMLSelectElement).value).toBe('2');
	});

	it('after locating, sorts places nearest first and pre-selects one within 500 m', async () => {
		stubGeolocation(42.374, -71.11);
		const fetchMock = stubNominatim({});
		const { container, getByRole } = render(PlaceField, { props: { places: [lisbon, home] } });
		await fireEvent.click(getByRole('button', { name: 'Use my location' }));
		await waitFor(() => expect(optionLabels(container)[1]).toMatch(/^Home · 0\.1 km$/));
		expect(optionLabels(container)[2]).toMatch(/^Lisbon · /);
		expect((container.querySelector('select') as HTMLSelectElement).value).toBe('1');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('far from every place, selects New place and suggests a name from OpenStreetMap', async () => {
		stubGeolocation(40.7128, -74.006);
		const fetchMock = stubNominatim({ city: 'New York', state: 'New York', country_code: 'us' });
		const { container, getByRole } = render(PlaceField, { props: { places: [home] } });
		await fireEvent.click(getByRole('button', { name: 'Use my location' }));
		await waitFor(() =>
			expect((container.querySelector('input[name="place-name"]') as HTMLInputElement)?.value).toBe(
				'New York, New York'
			)
		);
		expect((container.querySelector('select') as HTMLSelectElement).value).toBe('new');
		expect(fetchMock.mock.calls[0][0]).toContain('nominatim.openstreetmap.org/reverse');
	});
});
