import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
	PutObjectCommand,
	S3Client,
	type PutObjectCommandInput
} from '@aws-sdk/client-s3';
import { createDb, type Post } from '../src/lib/db';
import { dateParts, permalink } from '../src/lib/slug';

export const SITE_ORIGIN = 'https://compostmodernism.org';

export function renderFrontmatter(post: Post): string {
	const lines = [
		'---',
		`id: ${post.id}`,
		`slug: ${post.slug}`,
		`created_at: ${new Date(post.created_at).toISOString()}`,
		`permalink: ${SITE_ORIGIN}${permalink(post)}`
	];
	if (post.title) lines.push(`title: ${JSON.stringify(post.title)}`);
	if (post.url) lines.push(`url: ${post.url}`);
	if (post.tags.length) {
		lines.push('tags:');
		for (const tag of post.tags) lines.push(`  - ${tag.name}`);
	}
	lines.push('---', '', post.body, '');
	return lines.join('\n');
}

export function archivePath(post: Post): string {
	const { year, month, day } = dateParts(post.created_at);
	return join('archive', year, month, day, `${post.slug}.md`);
}

export async function exportPosts(posts: Post[], rootDir: string): Promise<number> {
	for (const post of posts) {
		const rel = archivePath(post);
		const absolute = join(rootDir, rel);
		mkdirSync(dirname(absolute), { recursive: true });
		writeFileSync(absolute, renderFrontmatter(post), 'utf8');
	}
	return posts.length;
}

export function backupKey(date: Date): string {
	const iso = date.toISOString().slice(0, 10);
	return `backups/posts-${iso}.db`;
}

interface S3Like {
	send(command: PutObjectCommand): Promise<unknown>;
}

export async function backupDatabase(
	r2: S3Like,
	bucket: string,
	body: Buffer,
	key: string
): Promise<void> {
	const input: PutObjectCommandInput = {
		Bucket: bucket,
		Key: key,
		Body: body,
		ContentType: 'application/octet-stream'
	};
	await r2.send(new PutObjectCommand(input));
}

async function main(): Promise<void> {
	const dbPath = join(process.cwd(), 'posts.db');
	const db = createDb(dbPath);

	const posts = db.getPosts({ limit: 1_000_000 });
	const count = await exportPosts(posts, process.cwd());
	console.log(`Exported ${count} posts to archive/`);

	try {
		execSync('git add archive/', { stdio: 'inherit' });
		const date = new Date().toISOString().slice(0, 10);
		execSync(`git commit -m "chore: export posts ${date}"`, { stdio: 'inherit' });
		execSync('git push', { stdio: 'inherit' });
		console.log('Pushed archive to git');
	} catch {
		console.log('No git changes to commit');
	}

	db.raw.close();

	const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
	const missing = required.filter((k) => !process.env[k]);
	if (missing.length) {
		console.warn(`Skipping R2 backup — missing env: ${missing.join(', ')}`);
		return;
	}

	const r2 = new S3Client({
		region: 'auto',
		endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: process.env.R2_ACCESS_KEY_ID!,
			secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
		}
	});

	const key = backupKey(new Date());
	await backupDatabase(r2, process.env.R2_BUCKET!, readFileSync(dbPath), key);
	console.log(`Uploaded DB backup to R2: ${key}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
