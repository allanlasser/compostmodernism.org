import type { ServerLoad } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { isAuthorized } from '$lib/auth';
import { DEFAULT_SITE_URL } from '$lib/social';

export const load: ServerLoad = async event => {
	const admin = isAuthorized(event);
	return { admin, siteUrl: env.SITE_URL ?? DEFAULT_SITE_URL };
};
