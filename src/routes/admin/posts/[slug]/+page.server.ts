import { error, type ServerLoad } from '@sveltejs/kit';
import { getPostBySlug, getPlaceNames, getPostLocation } from '$lib/db';
import { permalink, shortlink } from '$lib/slug';

export const load: ServerLoad = async ({ params }) => {
	const slug = params.slug;
	if (!slug) throw error(404, 'Not found');
	const post = getPostBySlug(slug, { includeDrafts: true });
	if (!post) throw error(404, 'Not found');
	return {
		post: { ...post, permalink: permalink(post), shortlink: shortlink(post) },
		location: getPostLocation(post.id),
		places: getPlaceNames()
	};
};
