import type { ServerLoad } from '@sveltejs/kit';
import { getPosts, countPosts, getPostCadence } from '$lib/db';
import { permalink } from '$lib/slug';

export const _PER_PAGE = 25;

export const load: ServerLoad = async ({ url }) => {
	const total = countPosts();
	const totalPages = Math.max(1, Math.ceil(total / _PER_PAGE));

	const raw = Number(url.searchParams.get('page') ?? '1');
	const page = Number.isFinite(raw) && raw >= 1 ? Math.min(Math.trunc(raw), totalPages) : 1;
	const offset = (page - 1) * _PER_PAGE;

	const posts = getPosts({ limit: _PER_PAGE, offset });
	return {
		posts: posts.map((p) => ({ ...p, permalink: permalink(p) })),
		page,
		perPage: _PER_PAGE,
		total,
		totalPages,
		cadence: getPostCadence()
	};
};
