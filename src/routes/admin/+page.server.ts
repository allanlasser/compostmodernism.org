import { redirect, type ServerLoad } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getPosts } from '$lib/db';
import { permalink } from '$lib/slug';

export const load: ServerLoad = async ({ cookies, url }) => {
	const session = cookies.get('session');

	if (env.POST_SECRET && session === env.POST_SECRET) {
		const posts = getPosts({ limit: 100 });
		return { posts: posts.map((p) => ({ ...p, permalink: permalink(p) })) };
	}

	// Break the redirect loop: when /admin?auth=required is hit without a session,
	// render the login form instead of redirecting again.
	if (url.searchParams.get('auth') === 'required') return {};

	throw redirect(303, '/admin?auth=required');
};
