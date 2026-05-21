import { z } from 'zod';

function isNonEmptyString(t: unknown): t is string {
	return typeof t === 'string' && t.trim().length > 0;
}

const emptyToNull = z
	.string()
	.trim()
	.nullish()
	.transform((v) => v || null);

const slugSchema = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase letters, digits, and hyphens');

export const postInputSchema = z.object({
	body: z.string().trim().min(1, 'body is required'),
	title: emptyToNull,
	url: emptyToNull,
	slug: slugSchema.optional(),
	tags: z
		.array(z.unknown())
		.optional()
		.default([])
		.transform((arr) => arr.filter(isNonEmptyString).map((s) => s.trim()))
});

export type PostInputInput = z.input<typeof postInputSchema>;
export type PostInputParsed = z.infer<typeof postInputSchema>;

export const postUpdateSchema = z.object({
	body: z.string().trim().optional(),
	title: z.string().trim().nullable().optional(),
	url: z.string().trim().nullable().optional(),
	tags: z.array(z.string().trim()).optional(),
	slug: slugSchema.optional(),
	created_at: z.number().int().positive().optional()
});

export type PostUpdateInput = z.input<typeof postUpdateSchema>;
export type PostUpdateParsed = z.infer<typeof postUpdateSchema>;

const trimOrNull = z
	.string()
	.trim()
	.nullable()
	.optional()
	.transform((v) => (v === undefined ? undefined : v || null));

export const imageMetadataSchema = z.object({
	title: trimOrNull,
	alt: trimOrNull,
	caption: trimOrNull,
	credit: trimOrNull
});

export type ImageMetadataInput = z.input<typeof imageMetadataSchema>;
export type ImageMetadataParsed = z.infer<typeof imageMetadataSchema>;
