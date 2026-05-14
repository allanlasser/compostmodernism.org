import { json, type RequestHandler } from '@sveltejs/kit';
import { insertPost } from '$lib/db';
import { permalink } from '$lib/slug';
import { env } from '$env/dynamic/private';
import { z } from 'zod';

const postInputSchema = z.object({
	body: z.string().trim().min(1, 'body is required'),
	title: z.string().trim().nullable().optional(),
	url: z.string().trim().nullable().optional(),
	tags: z.array(z.string().trim()).optional().default([])
});

export const POST: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('Authorization');
	if (!env.POST_SECRET || auth !== `Bearer ${env.POST_SECRET}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const parsed = postInputSchema.safeParse(await request.json());
	if (!parsed.success) {
		return json({ error: parsed.error.flatten((i) => i.message) }, { status: 400 });
	}

	const { body, title, url, tags } = parsed.data;

	if (url && !title) {
		return json({ error: 'title is required when url is provided' }, { status: 400 });
	}

	const result = insertPost({ body, title: title ?? null, url: url ?? null, tags });

	return json(
		{ ok: true, permalink: permalink({ slug: result.slug, created_at: Date.now() }) },
		{ status: 201 }
	);
};
