import { error, type ServerLoad } from '@sveltejs/kit';
import { getPostBySlug } from '$lib/db';
import { permalink } from '$lib/slug';

export const load: ServerLoad = async ({ params }) => {
	const slug = params.slug;
	if (!slug) throw error(404, 'Not found');
	const post = getPostBySlug(slug);
	if (!post) throw error(404, 'Not found');
	return { post: { ...post, permalink: permalink(post) } };
};
