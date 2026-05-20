import { Feed } from 'feed';
import type { RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getPosts, type Post } from '$lib/db';
import { permalink } from '$lib/slug';
import { renderMarkdown } from '$lib/markdown';

const DEFAULT_SITE_URL = 'https://compostmodernism.org';

export function _buildFeed(posts: Post[], siteUrl: string): string {
	const site = siteUrl.replace(/\/$/, '');
	const feed = new Feed({
		title: 'compostmodernism',
		description: 'A blog by Allan Lasser.',
		id: `${site}/`,
		link: `${site}/`,
		language: 'en',
		feedLinks: { rss: `${site}/feeds/posts.xml` },
		author: { name: 'Allan Lasser', link: 'https://allanlasser.com' },
		copyright: `© ${new Date().getUTCFullYear()} Allan Lasser`,
		updated: posts[0] ? new Date(posts[0].created_at) : undefined
	});

	for (const post of posts) {
		const canonical = `${site}${permalink(post)}`;
		const title = post.title ?? new Date(post.created_at).toUTCString();
		feed.addItem({
			title,
			link: post.url ?? canonical,
			guid: canonical,
			date: new Date(post.created_at),
			content: renderMarkdown(post.body),
			category: post.tags.map((t) => ({ name: t.name, domain: `${site}/tag/${t.slug}` }))
		});
	}

	return feed.rss2();
}

export const GET: RequestHandler = async ({ setHeaders }) => {
	const siteUrl = env.SITE_URL ?? DEFAULT_SITE_URL;
	const posts = getPosts();
	const xml = _buildFeed(posts, siteUrl);
	setHeaders({
		'Content-Type': 'application/rss+xml; charset=utf-8',
		'Cache-Control': 'public, max-age=300'
	});
	return new Response(xml);
};
