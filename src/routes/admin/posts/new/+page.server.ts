import type { ServerLoad } from '@sveltejs/kit';
import { getPlaces } from '$lib/db';

export const load: ServerLoad = async () => ({ places: getPlaces() });
