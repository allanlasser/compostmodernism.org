import type { ServerLoad } from '@sveltejs/kit';
import { getPosts } from '$lib/db';
import { permalink } from '$lib/slug';

export const load: ServerLoad = async () => {
	const posts = getPosts();
	return {
		feed: posts.map((p) => ({ ...p, permalink: permalink(p) }))
	};
};
