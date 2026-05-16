import type { ServerLoad } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const load: ServerLoad = async ({ cookies }) => {
	const session = cookies.get('session');
	const admin = Boolean(env.POST_SECRET) && session === env.POST_SECRET;
	return { admin };
};
