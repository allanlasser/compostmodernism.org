import { describe, it, expect } from 'vitest';
import { postInputSchema, postUpdateSchema, imageMetadataSchema } from './schemas';

describe('postInputSchema', () => {
	it('requires non-empty body', () => {
		const r = postInputSchema.safeParse({ body: '' });
		expect(r.success).toBe(false);
	});

	it('defaults tags to [] and drops non-strings', () => {
		const r = postInputSchema.safeParse({ body: 'hi', tags: ['a', 2, '', 'b'] });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.tags).toEqual(['a', 'b']);
	});

	it('coerces empty title/url to null', () => {
		const r = postInputSchema.safeParse({ body: 'b', title: '', url: '' });
		expect(r.success).toBe(true);
		if (r.success) {
			expect(r.data.title).toBeNull();
			expect(r.data.url).toBeNull();
		}
	});
});

describe('postUpdateSchema', () => {
	it('all fields optional', () => {
		const r = postUpdateSchema.safeParse({});
		expect(r.success).toBe(true);
	});

	it('accepts partial updates', () => {
		const r = postUpdateSchema.safeParse({ title: 'new' });
		expect(r.success).toBe(true);
	});
});

describe('imageMetadataSchema', () => {
	it('all fields optional and nullable', () => {
		const r = imageMetadataSchema.safeParse({});
		expect(r.success).toBe(true);
	});

	it('accepts trimmed strings or nulls', () => {
		const r = imageMetadataSchema.safeParse({
			title: '  Hello  ',
			alt: null,
			caption: 'A caption',
			credit: null
		});
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.title).toBe('Hello');
	});
});
