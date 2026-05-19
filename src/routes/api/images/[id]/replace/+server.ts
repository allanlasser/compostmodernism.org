import { json, type RequestHandler } from '@sveltejs/kit';
import sharp from 'sharp';
import { env } from '$env/dynamic/private';
import { uploadToR2 } from '$lib/r2';
import { getImageById, touchImage } from '$lib/db';
import { isAuthorized } from '$lib/auth';
import { z } from 'zod';

const uploadInputSchema = z.object({
	image: z.instanceof(File)
});

function parseId(raw: string | undefined): number | null {
	if (!raw) return null;
	const n = Number(raw);
	return Number.isInteger(n) && n > 0 ? n : null;
}

export const POST: RequestHandler = async (event) => {
	if (!isAuthorized(event)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const id = parseId(event.params.id);
	if (id === null) return json({ error: 'Invalid id' }, { status: 400 });

	const existing = getImageById(id);
	if (!existing) return json({ error: 'Not found' }, { status: 404 });

	const parsed = uploadInputSchema.safeParse(Object.fromEntries(await event.request.formData()));
	if (!parsed.success) {
		return json({ error: 'image file is required' }, { status: 400 });
	}
	const { image: file } = parsed.data;

	const inputBuffer = Buffer.from(await file.arrayBuffer());

	let outputBuffer: Buffer;
	try {
		outputBuffer = await sharp(inputBuffer)
			.rotate()
			.resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
			.webp({ quality: 82 })
			.toBuffer();
	} catch {
		return json({ error: 'Image processing failed' }, { status: 500 });
	}

	let url: string;
	try {
		url = await uploadToR2(existing.key, outputBuffer, 'image/webp');
	} catch {
		return json({ error: 'Upload failed' }, { status: 500 });
	}

	touchImage(id);

	const base = (env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');
	return json({ ok: true, url: url || `${base}/${existing.key}` });
};
