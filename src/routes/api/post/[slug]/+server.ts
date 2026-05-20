import { json, type RequestHandler } from '@sveltejs/kit';
import { getPostBySlug, updatePost, deletePost, slugTaken } from '$lib/db';
import { isAuthorized } from '$lib/auth';
import { postUpdateSchema } from '$lib/schemas';

export const PATCH: RequestHandler = async (event) => {
	const { request, params } = event;

	if (!isAuthorized(event)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const slug = params.slug;
	if (!slug) return json({ error: 'Slug not provided' }, { status: 400 });

	const post = getPostBySlug(slug);
	if (!post) return json({ error: 'Not found' }, { status: 404 });

	const parsed = postUpdateSchema.safeParse(await request.json());
	if (!parsed.success) {
		return json({ error: parsed.error.flatten((i) => i.message) }, { status: 400 });
	}

	const { body, title, url, tags, slug: newSlug, created_at } = parsed.data;

	if (url && !title) {
		return json({ error: 'title is required when url is provided' }, { status: 400 });
	}

	if (newSlug && newSlug !== slug && slugTaken(newSlug)) {
		return json(
			{ error: `slug "${newSlug}" is already in use by another post` },
			{ status: 409 }
		);
	}

	updatePost(slug, {
		body: body ?? post.body,
		title: title !== undefined ? title : post.title,
		url: url !== undefined ? url : post.url,
		tags,
		slug: newSlug,
		created_at
	});
	return json({ ok: true, slug: newSlug ?? slug });
};

export const DELETE: RequestHandler = async (event) => {
	if (!isAuthorized(event)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const slug = event.params.slug;
	if (!slug) return json({ error: 'Slug not provided' }, { status: 400 });

	const post = getPostBySlug(slug);
	if (!post) return json({ error: 'Not found' }, { status: 404 });

	deletePost(slug);
	return json({ ok: true });
};
