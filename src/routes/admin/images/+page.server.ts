import type { ServerLoad } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getImages, countImages } from '$lib/db';

export const _PER_PAGE = 25;

export const load: ServerLoad = async ({ url }) => {
	const total = countImages();
	const totalPages = Math.max(1, Math.ceil(total / _PER_PAGE));
	const raw = Number(url.searchParams.get('page') ?? '1');
	const page = Number.isFinite(raw) && raw >= 1 ? Math.min(Math.trunc(raw), totalPages) : 1;
	const offset = (page - 1) * _PER_PAGE;

	const rows = getImages({ limit: _PER_PAGE, offset });
	const base = (env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');
	const images = rows.map((r) => ({ ...r, url: `${base}/${r.key}` }));

	return { images, page, perPage: _PER_PAGE, total, totalPages };
};
