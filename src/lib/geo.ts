export interface Coordinates {
	latitude: number;
	longitude: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

export function distanceKm(a: Coordinates, b: Coordinates): number {
	const dLat = toRadians(b.latitude - a.latitude);
	const dLon = toRadians(b.longitude - a.longitude);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function nominatimReverseUrl({ latitude, longitude }: Coordinates): string {
	const params = new URLSearchParams({
		format: 'jsonv2',
		lat: String(latitude),
		lon: String(longitude),
		zoom: '10'
	});
	return `https://nominatim.openstreetmap.org/reverse?${params}`;
}

interface NominatimAddress {
	city?: string;
	town?: string;
	village?: string;
	hamlet?: string;
	state?: string;
	country?: string;
	country_code?: string;
}

export function placeNameFromNominatim(response: unknown): string {
	const address = (response as { address?: NominatimAddress } | null)?.address;
	if (!address) return '';
	const locality = address.city ?? address.town ?? address.village ?? address.hamlet;
	const region = address.country_code === 'us' ? address.state : address.country;
	return [locality, region].filter(Boolean).join(', ');
}
