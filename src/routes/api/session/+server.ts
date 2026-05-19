import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { z } from 'zod';

const sessionInputSchema = z.object({
	password: z.string()
});

export const POST: RequestHandler = async ({ request, cookies }) => {
	const parsed = sessionInputSchema.safeParse(await request.json());
	if (!parsed.success) {
		return json({ error: 'Bad request' }, { status: 400 });
	}
	const { password } = parsed.data;

	if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	cookies.set('session', env.POST_SECRET ?? '', {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'strict',
		maxAge: 60 * 60 * 24 * 30
	});

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	cookies.delete('session', { path: '/' });
	return json({ ok: true });
};
