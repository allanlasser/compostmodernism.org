import { describe, it, expect } from 'vitest';
import { slugify, hashSlug, dateParts, permalink } from './slug';

describe('slugify', () => {
	it('lowercases and hyphenates', () => {
		expect(slugify('Hello, World!')).toBe('hello-world');
	});

	it('strips leading and trailing hyphens', () => {
		expect(slugify('---hello---')).toBe('hello');
	});

	it('collapses consecutive spaces and underscores into a single hyphen', () => {
		expect(slugify('hello   world__again')).toBe('hello-world-again');
	});

	it('returns empty string for empty input', () => {
		expect(slugify('')).toBe('');
	});

	it('removes punctuation but keeps word characters', () => {
		expect(slugify("Don't & Won't")).toBe('dont-wont');
	});
});

describe('hashSlug', () => {
	it('returns an 8-character hex string', () => {
		const slug = hashSlug(1719792000000);
		expect(slug).toMatch(/^[0-9a-f]{8}$/);
	});

	it('is deterministic for the same timestamp', () => {
		expect(hashSlug(1719792000000)).toBe(hashSlug(1719792000000));
	});

	it('produces different hashes for different timestamps', () => {
		expect(hashSlug(1719792000000)).not.toBe(hashSlug(1719792000001));
	});
});

describe('dateParts', () => {
	it('zero-pads month and day', () => {
		// 2024-07-01T00:00:00Z
		expect(dateParts(Date.UTC(2024, 6, 1))).toEqual({
			year: '2024',
			month: '07',
			day: '01'
		});
	});

	it('uses UTC — midnight UTC on Jan 1 stays in January', () => {
		expect(dateParts(Date.UTC(2025, 0, 1, 0, 0, 0))).toEqual({
			year: '2025',
			month: '01',
			day: '01'
		});
	});
});

describe('permalink', () => {
	const created_at = Date.UTC(2024, 6, 1);

	it('builds a path from a titled post', () => {
		expect(permalink({ slug: 'hello-world', created_at })).toBe('/2024/07/01/hello-world');
	});

	it('builds a path from an untitled post (hash slug)', () => {
		expect(permalink({ slug: 'a3b4c5d6', created_at })).toBe('/2024/07/01/a3b4c5d6');
	});
});
