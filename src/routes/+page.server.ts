import type { ServerLoad } from '@sveltejs/kit';
import { getPosts, countPosts } from '$lib/db';
import { permalink } from '$lib/slug';

const INITIAL_LIMIT = 50;

export const load: ServerLoad = async () => {
	const posts = getPosts({ limit: INITIAL_LIMIT });
	return {
		feed: posts.map((p) => ({ ...p, permalink: permalink(p) })),
		nextOffset: posts.length < countPosts() ? posts.length : null
	};
};
