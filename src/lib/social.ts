import { renderMarkdown } from './markdown';
import type { Post } from './types';

export const SITE_NAME = 'compostmodernism';
export const SITE_DESCRIPTION = 'A blog by Allan Lasser.';
export const DEFAULT_SITE_URL = 'https://compostmodernism.org';

const DESCRIPTION_LIMIT = 200;

export interface SocialMeta {
	type: 'article' | 'website';
	title: string;
	documentTitle: string;
	description?: string;
	url: string;
	image?: string;
	imageAlt?: string;
	publishedTime?: string;
}

// A preview is one static string, so it can't follow the reader's timezone
// the way the on-page Dateline does after hydration.
const dateTitle = new Intl.DateTimeFormat('en-US', {
	dateStyle: 'long',
	timeStyle: 'short',
	timeZone: 'America/New_York'
});

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' '
};

function decodeEntities(s: string): string {
	return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
		if (code[0] === '#') {
			const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
			return Number.isFinite(n) ? String.fromCodePoint(n) : match;
		}
		return ENTITIES[code.toLowerCase()] ?? match;
	});
}

function attr(tag: string, name: string): string | undefined {
	const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
	if (!m) return undefined;
	return decodeEntities(m[1] ?? m[2]);
}

function firstImage(html: string, siteUrl: string): { src: string; alt?: string } | null {
	const tag = html.match(/<img\b[^>]*>/i)?.[0];
	const src = tag && attr(tag, 'src');
	if (!tag || !src) return null;
	try {
		return { src: new URL(src, siteUrl).href, alt: attr(tag, 'alt') || undefined };
	} catch {
		return null;
	}
}

function plainText(html: string): string {
	const text = html
		.replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, ' ')
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/<[^>]*>/g, '');
	return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

function truncate(text: string, limit: number): string {
	if (text.length <= limit) return text;
	const cut = text.slice(0, limit + 1);
	const lastSpace = cut.lastIndexOf(' ');
	const head = lastSpace > 0 ? cut.slice(0, lastSpace) : text.slice(0, limit);
	return `${head.replace(/[\s.,;:!?-]+$/, '')}…`;
}

function origin(siteUrl: string): string {
	return siteUrl.replace(/\/+$/, '');
}

export function postSocialMeta(post: Post, siteUrl: string): SocialMeta {
	const html = renderMarkdown(post.body);
	const title = post.title || dateTitle.format(new Date(post.date)).replace(/ /g, ' ');
	const description = truncate(plainText(html), DESCRIPTION_LIMIT);
	const image = firstImage(html, `${origin(siteUrl)}/`);

	return {
		type: 'article',
		title,
		documentTitle: `${title} · ${SITE_NAME}`,
		url: `${origin(siteUrl)}${post.permalink}`,
		publishedTime: new Date(post.date).toISOString(),
		...(description && { description }),
		...(image && { image: image.src }),
		...(image?.alt && { imageAlt: image.alt })
	};
}

export function siteSocialMeta(siteUrl: string, path: string): SocialMeta {
	return {
		type: 'website',
		title: SITE_NAME,
		documentTitle: SITE_NAME,
		description: SITE_DESCRIPTION,
		url: `${origin(siteUrl)}${path}`
	};
}

export function tagSocialMeta(siteUrl: string, tag: string): SocialMeta {
	const title = `#${tag}`;
	return {
		type: 'website',
		title,
		documentTitle: `${title} · ${SITE_NAME}`,
		description: `Posts tagged ${tag} on ${SITE_NAME}, a blog by Allan Lasser.`,
		url: `${origin(siteUrl)}/tag/${tag}`
	};
}

export function placeSocialMeta(siteUrl: string, place: { name: string; slug: string }): SocialMeta {
	return {
		type: 'website',
		title: place.name,
		documentTitle: `${place.name} · ${SITE_NAME}`,
		description: `Posts written in ${place.name} on ${SITE_NAME}, a blog by Allan Lasser.`,
		url: `${origin(siteUrl)}/place/${place.slug}`
	};
}
