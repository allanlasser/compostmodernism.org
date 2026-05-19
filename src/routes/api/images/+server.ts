import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getImages, countImages } from '$lib/db';
import { isAuthorized } from '$lib/auth';

export const _PER_PAGE = 25;

export const GET: RequestHandler = async (event) => {
	if (!isAuthorized(event)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const total = countImages();
	const totalPages = Math.max(1, Math.ceil(total / _PER_PAGE));
	const raw = Number(event.url.searchParams.get('page') ?? '1');
	const page = Number.isFinite(raw) && raw >= 1 ? Math.min(Math.trunc(raw), totalPages) : 1;
	const offset = (page - 1) * _PER_PAGE;
	const rows = getImages({ limit: _PER_PAGE, offset });

	const base = (env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');
	const images = rows.map((r) => ({ ...r, url: `${base}/${r.key}` }));

	return json({ images, page, perPage: _PER_PAGE, total, totalPages });
};
