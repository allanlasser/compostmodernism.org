import { redirect, type ServerLoad } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const LOGIN_PATH = '/admin/login';

export const load: ServerLoad = async ({ cookies, url }) => {
	const session = cookies.get('session');
	const authed = Boolean(env.POST_SECRET) && session === env.POST_SECRET;

	if (url.pathname === LOGIN_PATH) {
		if (authed) throw redirect(303, '/admin');
		return { authed: false };
	}

	if (!authed) throw redirect(303, LOGIN_PATH);
	return { authed: true };
};
