import { describe, it, expect } from 'vitest';
import {
	postInputSchema,
	postUpdateSchema,
	imageMetadataSchema,
	feedPageQuerySchema
} from './schemas';

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

	it('accepts an optional slug matching lowercase, digits, hyphens', () => {
		const r = postInputSchema.safeParse({ body: 'b', slug: 'hello-world-2' });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.slug).toBe('hello-world-2');
	});

	it('rejects a slug with spaces, uppercase, or other characters', () => {
		for (const bad of ['Hello World', 'HELLO', 'foo bar', 'foo/bar', 'foo.bar', '']) {
			const r = postInputSchema.safeParse({ body: 'b', slug: bad });
			expect(r.success).toBe(false);
		}
	});

	it('omits slug from parsed output when not provided', () => {
		const r = postInputSchema.safeParse({ body: 'b' });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.slug).toBeUndefined();
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

	it('accepts an optional slug matching lowercase, digits, hyphens', () => {
		const r = postUpdateSchema.safeParse({ slug: 'hello-world-2' });
		expect(r.success).toBe(true);
	});

	it('rejects a slug with spaces, uppercase, or other characters', () => {
		for (const bad of ['Hello World', 'HELLO', 'foo bar', 'foo/bar', 'foo.bar', '']) {
			const r = postUpdateSchema.safeParse({ slug: bad });
			expect(r.success).toBe(false);
		}
	});

	it('accepts an optional created_at as a positive integer (ms epoch)', () => {
		const r = postUpdateSchema.safeParse({ created_at: 1700000000000 });
		expect(r.success).toBe(true);
	});

	it('rejects a non-integer or non-positive created_at', () => {
		expect(postUpdateSchema.safeParse({ created_at: -1 }).success).toBe(false);
		expect(postUpdateSchema.safeParse({ created_at: 1.5 }).success).toBe(false);
		expect(postUpdateSchema.safeParse({ created_at: 'today' }).success).toBe(false);
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

describe('feedPageQuerySchema', () => {
	it('defaults offset to 0 and limit to 25', () => {
		const r = feedPageQuerySchema.safeParse({});
		expect(r.success && r.data).toEqual({ offset: 0, limit: 25 });
	});

	it('coerces query-string values to integers', () => {
		const r = feedPageQuerySchema.safeParse({ offset: '50', limit: '10' });
		expect(r.success && r.data).toEqual({ offset: 50, limit: 10 });
	});

	it('caps limit at 50', () => {
		expect(feedPageQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
		expect(feedPageQuerySchema.safeParse({ limit: '50' }).success).toBe(true);
	});

	it('rejects negative, fractional, zero-limit and non-numeric values', () => {
		for (const bad of [{ offset: '-1' }, { offset: '1.5' }, { limit: '0' }, { offset: 'abc' }]) {
			expect(feedPageQuerySchema.safeParse(bad).success).toBe(false);
		}
	});
});

describe('place input', () => {
	it('accepts an existing place by id', () => {
		const r = postInputSchema.safeParse({ body: 'b', place: { id: 3 } });
		expect(r.success && r.data.place).toEqual({ id: 3 });
	});

	it('accepts a new place with trimmed name and coordinates', () => {
		const r = postInputSchema.safeParse({
			body: 'b',
			place: { name: '  Cambridge ', latitude: 42.37, longitude: -71.1 }
		});
		expect(r.success && r.data.place).toEqual({ name: 'Cambridge', latitude: 42.37, longitude: -71.1 });
	});

	it.each([
		{ name: 'x', latitude: 91, longitude: 0 },
		{ name: 'x', latitude: 0, longitude: -181 },
		{ name: '  ', latitude: 0, longitude: 0 },
		{ id: 0 }
	])('rejects %o', (place) => {
		expect(postInputSchema.safeParse({ body: 'b', place }).success).toBe(false);
	});

	it('accepts null on update to clear the place', () => {
		const r = postUpdateSchema.safeParse({ place: null });
		expect(r.success && r.data.place).toBeNull();
	});
});
