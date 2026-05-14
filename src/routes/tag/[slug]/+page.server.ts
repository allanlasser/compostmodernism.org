import { error, type ServerLoad } from '@sveltejs/kit';
import { getPostsByTag } from '$lib/db';
import { permalink } from '$lib/slug';

export const load: ServerLoad = async ({ params }) => {
	const posts = getPostsByTag(params.slug as string);
	if (posts === null) throw error(404, 'Tag not found');

	return {
		tag: params.slug,
		feed: posts.map((p) => ({ ...p, permalink: permalink(p) }))
	};
};
