import { redirect, type ServerLoad } from '@sveltejs/kit';
import { isAuthorized } from '$lib/auth';

const LOGIN_PATH = '/admin/login';

export const load: ServerLoad = async event => {
	const authed = isAuthorized(event);

	if (event.url.pathname === LOGIN_PATH) {
		if (authed) throw redirect(303, '/admin');
		return { authed: false };
	}

	if (!authed) throw redirect(303, LOGIN_PATH);
	return { authed: true };
};
