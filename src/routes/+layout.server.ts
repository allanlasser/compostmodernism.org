import type { ServerLoad } from '@sveltejs/kit';
import { isAuthorized } from '$lib/auth';

export const load: ServerLoad = async event => {
	const admin = isAuthorized(event)
	return { admin };
};
