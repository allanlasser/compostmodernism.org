import { error, type ServerLoad } from '@sveltejs/kit';
import { getPlaceBySlug, getPostsByPlace } from '$lib/db';
import { permalink } from '$lib/slug';

export const load: ServerLoad = async ({ params }) => {
	const place = getPlaceBySlug(params.slug as string);
	const posts = getPostsByPlace(params.slug as string);
	if (!place || posts === null) throw error(404, 'Place not found');

	return {
		place,
		feed: posts.map((p) => ({ ...p, permalink: permalink(p) }))
	};
};
