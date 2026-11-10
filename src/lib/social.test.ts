import { describe, it, expect } from 'vitest';
import { postSocialMeta, siteSocialMeta } from './social';
import type { Post } from './types';

const SITE = 'https://compostmodernism.org';
// 2026-11-10 19:32 UTC → 2:32 PM Eastern (EST)
const ts = Date.UTC(2026, 10, 10, 19, 32);

function post(over: Partial<Post> = {}): Post {
	return {
		slug: 'hello',
		body: 'Some words.',
		title: 'Hello',
		url: null,
		date: ts,
		tags: [],
		permalink: '/2026/11/10/hello',
		...over
	};
}

describe('postSocialMeta', () => {
	it('uses the post title', () => {
		expect(postSocialMeta(post(), SITE).title).toBe('Hello');
	});

	it('uses the Eastern publish datetime when the post is untitled', () => {
		expect(postSocialMeta(post({ title: null }), SITE).title).toBe(
			'November 10, 2026 at 2:32 PM'
		);
	});

	it('points link posts at the permalink, not the external url', () => {
		const meta = postSocialMeta(post({ url: 'https://example.com/article' }), SITE);
		expect(meta.url).toBe('https://compostmodernism.org/2026/11/10/hello');
	});

	it('describes the post with its body as plain text', () => {
		const meta = postSocialMeta(
			post({ body: 'A *very* [good](https://x.test) day & night.\n\nIs 3 < 4?' }),
			SITE
		);
		expect(meta.description).toBe('A very good day & night. Is 3 < 4?');
	});

	it('truncates long bodies at a word boundary', () => {
		const body = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
		const description = postSocialMeta(post({ body }), SITE).description as string;
		expect(description.length).toBeLessThanOrEqual(201);
		expect(description).toMatch(/word\d+…$/);
		expect(body.startsWith(description.slice(0, -1))).toBe(true);
	});

	it('uses the first image in the body', () => {
		const meta = postSocialMeta(
			post({
				body: 'Look:\n\n![A heron](https://images.test/a.webp?x=1&y=2)\n\n![Second](https://images.test/b.webp)'
			}),
			SITE
		);
		expect(meta.image).toBe('https://images.test/a.webp?x=1&y=2');
		expect(meta.imageAlt).toBe('A heron');
		expect(meta.description).toBe('Look:');
	});

	it('resolves a relative image against the site url', () => {
		const meta = postSocialMeta(post({ body: '<img src="/favicon.png" alt="">' }), SITE);
		expect(meta.image).toBe('https://compostmodernism.org/favicon.png');
	});

	it('is an article with a published time', () => {
		const meta = postSocialMeta(post(), SITE);
		expect(meta.type).toBe('article');
		expect(meta.publishedTime).toBe('2026-11-10T19:32:00.000Z');
		expect(meta.documentTitle).toBe('Hello · compostmodernism');
	});
});

describe('siteSocialMeta', () => {
	it('describes the site at the given path', () => {
		expect(siteSocialMeta(`${SITE}/`, '/tag/birds')).toEqual({
			type: 'website',
			title: 'compostmodernism',
			documentTitle: 'compostmodernism',
			description: 'A blog by Allan Lasser.',
			url: 'https://compostmodernism.org/tag/birds'
		});
	});
});
