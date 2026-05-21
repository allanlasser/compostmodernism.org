import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import { getPostById, getPostByOldToken } from '$lib/db';
import { decodeId } from '$lib/shortid';
import { permalink } from '$lib/slug';

export const GET: RequestHandler = async ({ params }) => {
	const token = params.token ?? '';
	const id = decodeId(token);
	const post = (id ? getPostById(id) : null) ?? getPostByOldToken(token);
	if (!post) throw error(404, 'Not found');
	throw redirect(301, permalink(post));
};
