import { encodeId } from './shortid';

export function slugify(title: string): string {
	return title
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export interface DateParts {
	year: string;
	month: string;
	day: string;
}

export function dateParts(timestamp: number): DateParts {
	const d = new Date(timestamp);
	return {
		year: String(d.getUTCFullYear()),
		month: String(d.getUTCMonth() + 1).padStart(2, '0'),
		day: String(d.getUTCDate()).padStart(2, '0')
	};
}

export interface PermalinkInput {
	slug: string;
	created_at: number;
}

export function permalink(post: PermalinkInput): string {
	const { year, month, day } = dateParts(post.created_at);
	return `/${year}/${month}/${day}/${post.slug}`;
}

export const SHORT_URL_BASE = 'https://cmpst.org';

export interface ShortlinkInput {
	id: number;
}

export function shortlink(post: ShortlinkInput): string {
	return `${SHORT_URL_BASE}/p/${encodeId(post.id)}`;
}
