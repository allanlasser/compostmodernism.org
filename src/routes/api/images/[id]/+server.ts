import { json, type RequestHandler } from '@sveltejs/kit';
import {
	getImageById,
	updateImage,
	getPostsForImage,
	deleteImage
} from '$lib/db';
import { deleteFromR2 } from '$lib/r2';
import { isAuthorized } from '$lib/auth';
import { imageMetadataSchema } from '$lib/schemas';

function parseId(raw: string | undefined): number | null {
	if (!raw) return null;
	const n = Number(raw);
	return Number.isInteger(n) && n > 0 ? n : null;
}

export const PATCH: RequestHandler = async (event) => {
	if (!isAuthorized(event)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const id = parseId(event.params.id);
	if (id === null) return json({ error: 'Invalid id' }, { status: 400 });

	const existing = getImageById(id);
	if (!existing) return json({ error: 'Not found' }, { status: 404 });

	const parsed = imageMetadataSchema.safeParse(await event.request.json());
	if (!parsed.success) {
		return json({ error: parsed.error.flatten((i) => i.message) }, { status: 400 });
	}

	updateImage(id, parsed.data);
	const image = getImageById(id);
	return json({ ok: true, image });
};

export const DELETE: RequestHandler = async (event) => {
	if (!isAuthorized(event)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const id = parseId(event.params.id);
	if (id === null) return json({ error: 'Invalid id' }, { status: 400 });

	const existing = getImageById(id);
	if (!existing) return json({ error: 'Not found' }, { status: 404 });

	const force = event.url.searchParams.get('force') === 'true';
	const usage = getPostsForImage(id);
	if (usage.length > 0 && !force) {
		return json(
			{ error: 'Image is in use by one or more posts', posts: usage },
			{ status: 409 }
		);
	}

	try {
		await deleteFromR2(existing.key);
	} catch {
		return json({ error: 'Could not delete from R2' }, { status: 500 });
	}

	deleteImage(id);
	return json({ ok: true });
};
