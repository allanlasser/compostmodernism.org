import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

type AuthEvent = Pick<RequestEvent, 'request'> & {
	cookies?: Pick<RequestEvent['cookies'], 'get'>;
};

export function isAuthorized(event: AuthEvent): boolean {
	if (!env.POST_SECRET) return false;
	if (event.request.headers.get('Authorization') === `Bearer ${env.POST_SECRET}`) return true;
	if (event.cookies?.get('session') === env.POST_SECRET) return true;
	return false;
}
