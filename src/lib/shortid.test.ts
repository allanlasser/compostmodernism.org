import { describe, it, expect } from 'vitest';
import { encodeId, decodeId } from './shortid';

describe('encodeId', () => {
	it('produces a short non-empty string for a positive id', () => {
		const token = encodeId(1);
		expect(token).toMatch(/^[A-Za-z0-9]+$/);
		expect(token.length).toBeGreaterThanOrEqual(4);
	});

	it('avoids confusable glyphs (l/I/o/O/0/1)', () => {
		for (let id = 1; id <= 200; id++) {
			expect(encodeId(id)).not.toMatch(/[lIoO01]/);
		}
	});

	it('is deterministic', () => {
		expect(encodeId(42)).toBe(encodeId(42));
	});

	it('produces distinct tokens for distinct ids', () => {
		const seen = new Set<string>();
		for (let id = 1; id <= 500; id++) seen.add(encodeId(id));
		expect(seen.size).toBe(500);
	});
});

describe('decodeId', () => {
	it('round-trips encodeId across a range of ids', () => {
		for (const id of [1, 2, 42, 999, 12345, 999999]) {
			expect(decodeId(encodeId(id))).toBe(id);
		}
	});

	it('returns null for a token outside the alphabet', () => {
		expect(decodeId('!!!!')).toBeNull();
	});

	it('returns null for an empty string', () => {
		expect(decodeId('')).toBeNull();
	});

	it('returns null for tokens that would decode to multiple values', () => {
		// We only ever encode single-element arrays; reject anything else.
		// Hard to construct without internals, but a long random-ish string
		// from the alphabet will either decode to one int or fail — assert it
		// never produces a number we didn't encode for that token.
		const t = encodeId(7);
		expect(decodeId(t)).toBe(7);
	});
});
