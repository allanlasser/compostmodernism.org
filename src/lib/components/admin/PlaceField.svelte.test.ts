import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/svelte';
import PlaceField from './PlaceField.svelte';
import type { KnownPlace } from '$lib/types';

const cambridge: KnownPlace = {
	name: 'Cambridge, Massachusetts',
	slug: 'cambridge-massachusetts',
	latitude: 42.3734,
	longitude: -71.1143,
	count: 9
};
const lisbon: KnownPlace = { name: 'Lisbon, Portugal', slug: 'lisbon-portugal', latitude: 38.7223, longitude: -9.1393, count: 2 };
const train: KnownPlace = { name: 'A train somewhere', slug: 'a-train-somewhere', latitude: null, longitude: null, count: 1 };

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

const nameInput = (c: HTMLElement) => c.querySelector('input[name="place"]') as HTMLInputElement;
const suggestions = (c: HTMLElement) =>
	[...c.querySelectorAll('datalist option')].map((o) => (o as HTMLOptionElement).value);

describe('PlaceField', () => {
	it('shows the initial name and coordinates', () => {
		const { container, getByText } = render(PlaceField, {
			props: { initial: { name: 'Lisbon, Portugal', slug: 'lisbon-portugal', latitude: 38.7223, longitude: -9.1393 } }
		});
		expect(nameInput(container).value).toBe('Lisbon, Portugal');
		expect(getByText(/38\.7223, -9\.1393/)).not.toBeNull();
	});

	it('offers known names, nearest first once located', async () => {
		stubGeolocation(38.72, -9.14);
		stubNominatim({});
		const { container, getByRole } = render(PlaceField, { props: { places: [train, cambridge, lisbon] } });
		expect(suggestions(container)).toEqual(['A train somewhere', 'Cambridge, Massachusetts', 'Lisbon, Portugal']);
		await fireEvent.click(getByRole('button', { name: 'Use my location' }));
		await waitFor(() =>
			expect(suggestions(container)).toEqual(['Lisbon, Portugal', 'Cambridge, Massachusetts', 'A train somewhere'])
		);
	});

	it('near a known place, fills in its name', async () => {
		stubGeolocation(42.3736, -71.1097);
		stubNominatim({ city: 'Somewhere Else' });
		const { container, getByRole } = render(PlaceField, { props: { places: [cambridge] } });
		await fireEvent.click(getByRole('button', { name: 'Use my location' }));
		await waitFor(() => expect(nameInput(container).value).toBe('Cambridge, Massachusetts'));
	});

	it('far from every known place, fills in the OpenStreetMap suggestion', async () => {
		stubGeolocation(40.7128, -74.006);
		const fetchMock = stubNominatim({ city: 'New York', state: 'New York', country_code: 'us' });
		const { container, getByRole } = render(PlaceField, { props: { places: [cambridge] } });
		await fireEvent.click(getByRole('button', { name: 'Use my location' }));
		await waitFor(() => expect(nameInput(container).value).toBe('New York, New York'));
		expect(fetchMock.mock.calls[0][0]).toContain('nominatim.openstreetmap.org/reverse');
	});
});
