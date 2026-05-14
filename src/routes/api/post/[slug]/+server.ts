import { json, type RequestHandler } from '@sveltejs/kit';
import { getPostBySlug, updatePost } from '$lib/db';
import { env } from '$env/dynamic/private';
import { z } from 'zod';

const postUpdateSchema = z.object({
	body: z.string().trim().optional(),
	title: z.string().trim().nullable().optional(),
	url: z.string().trim().nullable().optional(),
	tags: z.array(z.string().trim()).optional()
});

export const PATCH: RequestHandler = async ({ request, params }) => {
	const auth = request.headers.get('Authorization');
	
  // We need to be authenticated
  if (!env.POST_SECRET || auth !== `Bearer ${env.POST_SECRET}`) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // We need to have a slug in the route
  const slug = params.slug;
  if (!slug) return json({ error: 'Slug not provided' }, { status: 400 });

  // We need to match the slug to a post
  const post = getPostBySlug(slug);
  if (!post) return json({ error: 'Not found' }, { status: 404 });

  // We need to validate our incoming data
  const parsed = postUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return json({ error: parsed.error.flatten((i) => i.message) }, { status: 400 });
  }

  const { body, title, url, tags } = parsed.data;

  // Link posts require a title in addition to a URL
  if (url && !title) {
    return json({ error: 'title is required when url is provided' }, { status: 400 });
  }

  // Now we're ready to update the post.
  updatePost(slug, {
    body: body ?? post.body,
    title: title !== undefined ? title : post.title,
    url: url !== undefined ? url : post.url,
    tags
  });
  return json({ ok: true });
};
