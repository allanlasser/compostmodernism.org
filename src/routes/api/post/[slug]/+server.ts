import { json, type RequestHandler } from '@sveltejs/kit';
import { getPostBySlug, updatePost, deletePost } from '$lib/db';
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

	const { body, title, url, tags } = parsed.data;

	if (url && !title) {
		return json({ error: 'title is required when url is provided' }, { status: 400 });
	}

	updatePost(slug, {
		body: body ?? post.body,
		title: title !== undefined ? title : post.title,
		url: url !== undefined ? url : post.url,
		tags
	});
	return json({ ok: true });
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
