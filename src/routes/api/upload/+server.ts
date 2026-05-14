import { json, type RequestHandler } from '@sveltejs/kit';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { uploadToR2 } from '$lib/r2';
import { env } from '$env/dynamic/private';
import { z } from 'zod';

const uploadInputSchema = z.object({
	image: z.instanceof(File)
});

export const POST: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('Authorization');
	if (!env.POST_SECRET || auth !== `Bearer ${env.POST_SECRET}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const parsed = uploadInputSchema.safeParse(Object.fromEntries(await request.formData()));
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

	const now = Date.now();
	const hash = createHash('md5').update(String(now)).digest('hex').slice(0, 8);
	const d = new Date(now);
	const year = d.getUTCFullYear();
	const month = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');
	const key = `images/${year}/${month}/${day}/${hash}.webp`;

	let url: string;
	try {
		url = await uploadToR2(key, outputBuffer, 'image/webp');
	} catch {
		return json({ error: 'Upload failed' }, { status: 500 });
	}

	return json({ ok: true, url }, { status: 201 });
};
