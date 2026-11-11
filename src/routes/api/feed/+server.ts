import { json, type RequestHandler } from '@sveltejs/kit';
import { getPosts, countPosts } from '$lib/db';
import { feedPageQuerySchema } from '$lib/schemas';
import { permalink } from '$lib/slug';

export const GET: RequestHandler = async ({ url }) => {
	const parsed = feedPageQuerySchema.safeParse(Object.fromEntries(url.searchParams));
	if (!parsed.success) {
		return json({ error: parsed.error.flatten((i) => i.message) }, { status: 400 });
	}
	const { offset, limit } = parsed.data;

	const posts = getPosts({ limit, offset });
	const end = offset + posts.length;
	return json({
		posts: posts.map((p) => ({ ...p, permalink: permalink(p) })),
		nextOffset: end < countPosts() ? end : null
	});
};
