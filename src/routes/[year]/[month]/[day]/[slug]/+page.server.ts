import { error, redirect, type ServerLoad } from '@sveltejs/kit';
import { getPostBySlug } from '$lib/db';
import { permalink } from '$lib/slug';

export const load: ServerLoad = async ({ params }) => {
	const post = getPostBySlug(params.slug as string);
	if (!post) throw error(404, 'Post not found');

	const canonical = permalink(post);
	const actual = `/${params.year}/${params.month}/${params.day}/${params.slug}`;
	if (actual !== canonical) throw redirect(301, canonical);

	return { post: { ...post, permalink: canonical } };
};
