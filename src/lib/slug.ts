import { createHash } from 'node:crypto';

export function slugify(title: string): string {
	return title
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function hashSlug(timestamp: number): string {
	return createHash('md5').update(String(timestamp)).digest('hex').slice(0, 8);
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
