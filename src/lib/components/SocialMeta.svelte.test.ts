import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import SocialMeta from './SocialMeta.svelte';
import type { SocialMeta as Meta } from '$lib/social';

afterEach(cleanup);

function content(selector: string): string | null | undefined {
	return document.head.querySelector(selector)?.getAttribute('content');
}

const article: Meta = {
	type: 'article',
	title: 'Hello',
	documentTitle: 'Hello · compostmodernism',
	description: 'Some words.',
	url: 'https://compostmodernism.org/2026/11/10/hello',
	image: 'https://images.test/a.webp',
	imageAlt: 'A heron',
	publishedTime: '2026-11-10T19:32:00.000Z'
};

describe('SocialMeta', () => {
	it('renders Open Graph and Twitter tags for a post with an image', () => {
		render(SocialMeta, { props: { meta: article } });
		expect(document.title).toBe('Hello · compostmodernism');
		expect(content('meta[property="og:site_name"]')).toBe('compostmodernism');
		expect(content('meta[property="og:type"]')).toBe('article');
		expect(content('meta[property="og:title"]')).toBe('Hello');
		expect(content('meta[property="og:description"]')).toBe('Some words.');
		expect(content('meta[name="description"]')).toBe('Some words.');
		expect(content('meta[property="og:url"]')).toBe(article.url);
		expect(content('meta[property="og:image"]')).toBe('https://images.test/a.webp');
		expect(content('meta[property="og:image:alt"]')).toBe('A heron');
		expect(content('meta[property="article:published_time"]')).toBe(article.publishedTime);
		expect(content('meta[name="twitter:card"]')).toBe('summary_large_image');
		expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
			article.url
		);
	});

	it('uses a summary card when there is no image', () => {
		const { image: _i, imageAlt: _a, ...noImage } = article;
		render(SocialMeta, { props: { meta: noImage } });
		expect(content('meta[name="twitter:card"]')).toBe('summary');
	});
});
