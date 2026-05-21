import { json, type RequestHandler } from '@sveltejs/kit';
import { insertPost, slugTaken } from '$lib/db';
import { permalink } from '$lib/slug';
import { isAuthorized } from '$lib/auth';
import { postInputSchema } from '$lib/schemas';

export const POST: RequestHandler = async (event) => {
	if (!isAuthorized(event)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const parsed = postInputSchema.safeParse(await event.request.json());
	if (!parsed.success) {
		return json({ error: parsed.error.flatten((i) => i.message) }, { status: 400 });
	}

	const { body, title, url, tags, slug } = parsed.data;

	if (url && !title) {
		return json({ error: 'title is required when url is provided' }, { status: 400 });
	}

	if (slug && slugTaken(slug)) {
		return json({ error: `slug "${slug}" is already in use by another post` }, { status: 409 });
	}

	const result = insertPost({ body, title, url, tags, slug });

	return json(
		{ ok: true, slug: result.slug, permalink: permalink({ slug: result.slug, created_at: Date.now() }) },
		{ status: 201 }
	);
};
