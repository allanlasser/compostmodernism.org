import { json, type RequestHandler } from '@sveltejs/kit';
import { insertPost } from '$lib/db';
import { permalink } from '$lib/slug';
import { env } from '$env/dynamic/private';
import { z } from 'zod';

function isString(t: unknown): t is string {
  return typeof t === 'string' && t.trim().length > 0
}

const emptyToNull = z
	.string()
	.trim()
	.nullish()
	.transform((v) => v || null);

const postInputSchema = z.object({
	body: z.string().trim().min(1, 'body is required'),
	title: emptyToNull,
	url: emptyToNull,
	tags: z
		.array(z.unknown())
		.optional()
		.default([])
		.transform((arr) =>
			arr
				.filter(isString)
				.map((s) => s.trim())
		)
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

	const result = insertPost({ body, title, url, tags });

	return json(
		{ ok: true, permalink: permalink({ slug: result.slug, created_at: Date.now() }) },
		{ status: 201 }
	);
};
