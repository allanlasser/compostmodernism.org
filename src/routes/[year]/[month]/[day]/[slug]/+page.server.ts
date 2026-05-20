import { error, redirect, type ServerLoad } from '@sveltejs/kit';
import { getPostBySlug, getPostByOldPath } from '$lib/db';
import { permalink } from '$lib/slug';

export const load: ServerLoad = async ({ params }) => {
	const slug = params.slug as string;
	const post = getPostBySlug(slug);

	if (!post) {
		const moved = getPostByOldPath({
			year: Number(params.year),
			month: Number(params.month),
			day: Number(params.day),
			slug
		});
		if (moved) throw redirect(301, permalink(moved));
		throw error(404, 'Post not found');
	}

	const canonical = permalink(post);
	const actual = `/${params.year}/${params.month}/${params.day}/${params.slug}`;
	if (actual !== canonical) throw redirect(301, canonical);

	return { post: { ...post, permalink: canonical } };
};
