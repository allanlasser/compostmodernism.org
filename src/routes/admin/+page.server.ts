import { getPostCadence } from '$lib/db';
import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async () => {
	return { cadence: getPostCadence() };
};
