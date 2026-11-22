import { renderMarkdown } from './markdown';
import { attr, plainText, truncate } from './social';

const TEXT_LIMIT = 80;

export interface PostPreview {
	image: { src: string; alt: string } | null;
	text: string;
}

export function postPreview(body: string): PostPreview {
	const html = renderMarkdown(body);
	const lead = html.match(/^\s*<p>\s*(<img\b[^>]*>)/i)?.[1];
	const src = lead && attr(lead, 'src');
	return {
		image: src ? { src, alt: attr(lead, 'alt') ?? '' } : null,
		text: truncate(plainText(html), TEXT_LIMIT)
	};
}
