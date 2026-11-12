import { describe, it, expect } from 'vitest';
import { distanceKm, placeNameFromNominatim, nominatimReverseUrl } from './geo';

describe('distanceKm', () => {
	it('is zero for the same point', () => {
		expect(distanceKm({ latitude: 42, longitude: -71 }, { latitude: 42, longitude: -71 })).toBe(0);
	});

	it('measures Boston to New York at roughly 306 km', () => {
		const boston = { latitude: 42.3601, longitude: -71.0589 };
		const nyc = { latitude: 40.7128, longitude: -74.006 };
		expect(distanceKm(boston, nyc)).toBeCloseTo(306, -1);
	});
});

describe('nominatimReverseUrl', () => {
	it('asks the reverse endpoint for JSON at city zoom', () => {
		const url = new URL(nominatimReverseUrl({ latitude: 42.37, longitude: -71.11 }));
		expect(url.origin + url.pathname).toBe('https://nominatim.openstreetmap.org/reverse');
		expect(Object.fromEntries(url.searchParams)).toMatchObject({
			format: 'jsonv2',
			lat: '42.37',
			lon: '-71.11'
		});
	});
});

describe('placeNameFromNominatim', () => {
	it('uses locality and state in the US', () => {
		expect(
			placeNameFromNominatim({
				address: { city: 'Cambridge', state: 'Massachusetts', country: 'United States', country_code: 'us' }
			})
		).toBe('Cambridge, Massachusetts');
	});

	it('uses locality and country elsewhere', () => {
		expect(
			placeNameFromNominatim({
				address: { town: 'Sintra', state: 'Lisboa', country: 'Portugal', country_code: 'pt' }
			})
		).toBe('Sintra, Portugal');
	});

	it('falls back through village and hamlet to the bare region', () => {
		expect(
			placeNameFromNominatim({ address: { village: 'Wellfleet', state: 'Massachusetts', country_code: 'us' } })
		).toBe('Wellfleet, Massachusetts');
		expect(placeNameFromNominatim({ address: { country: 'Iceland', country_code: 'is' } })).toBe('Iceland');
	});

	it('returns an empty string for an unusable response', () => {
		expect(placeNameFromNominatim({ error: 'Unable to geocode' })).toBe('');
		expect(placeNameFromNominatim(null)).toBe('');
	});
});
