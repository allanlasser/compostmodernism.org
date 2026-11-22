import type { ServerLoad } from '@sveltejs/kit';
import { getPlaceNames } from '$lib/db';

export const load: ServerLoad = async () => ({ places: getPlaceNames() });
