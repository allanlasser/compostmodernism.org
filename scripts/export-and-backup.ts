import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
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

export function archiveEntryPath(post: Post): string {
	const { year, month, day } = dateParts(post.created_at);
	return `posts/${year}/${month}/${day}/${post.slug}.md`;
}

export function archiveFilename(date: Date): string {
	return `${date.toISOString().slice(0, 10)}.zip`;
}

export function r2Key(date: Date): string {
	return `backups/${archiveFilename(date)}`;
}

export function buildArchive(posts: Post[], dbBytes: Buffer): Buffer {
	const zip = new AdmZip();
	zip.addFile('posts.db', dbBytes);
	for (const post of posts) {
		zip.addFile(archiveEntryPath(post), Buffer.from(renderFrontmatter(post), 'utf8'));
	}
	return zip.toBuffer();
}

interface S3Like {
	send(command: PutObjectCommand): Promise<unknown>;
}

export async function uploadBackup(
	r2: S3Like,
	bucket: string,
	body: Buffer,
	key: string
): Promise<void> {
	const input: PutObjectCommandInput = {
		Bucket: bucket,
		Key: key,
		Body: body,
		ContentType: 'application/zip'
	};
	await r2.send(new PutObjectCommand(input));
}

const HEARTBEAT_TIMEOUT_MS = 10_000;

// A monitor outage must never fail the backup, so every problem here is a warning.
export async function pingHeartbeat(url: string | undefined, suffix = ''): Promise<void> {
	if (!url) {
		console.warn('Skipping heartbeat — missing env: BACKUP_HEARTBEAT_URL');
		return;
	}
	const target = `${url.replace(/\/+$/, '')}${suffix}`;
	try {
		const res = await fetch(target, { signal: AbortSignal.timeout(HEARTBEAT_TIMEOUT_MS) });
		if (!res.ok) console.warn(`Heartbeat ping returned ${res.status}`);
	} catch (err) {
		console.warn(`Heartbeat ping failed: ${err instanceof Error ? err.message : err}`);
	}
}

// `job` resolves true only when the archive was also mirrored to R2. A skipped mirror
// sends no signal, so the monitor's missed-ping alert covers removed or rotated credentials.
export async function runWithHeartbeat(
	job: () => Promise<boolean>,
	heartbeatUrl: string | undefined
): Promise<void> {
	let mirrored: boolean;
	try {
		mirrored = await job();
	} catch (err) {
		await pingHeartbeat(heartbeatUrl, '/fail');
		throw err;
	}
	if (!mirrored) {
		console.warn('Skipping heartbeat — archive was not mirrored to R2');
		return;
	}
	await pingHeartbeat(heartbeatUrl);
}

async function main(): Promise<boolean> {
	const dbPath = join(process.cwd(), 'posts.db');
	const db = createDb(dbPath);
	const posts = db.getPosts({ limit: 1_000_000 });
	db.raw.close();

	const now = new Date();
	const dbBytes = readFileSync(dbPath);
	const zipBuffer = buildArchive(posts, dbBytes);

	const filename = archiveFilename(now);
	const localPath = join(process.cwd(), 'archive', filename);
	mkdirSync(dirname(localPath), { recursive: true });
	writeFileSync(localPath, zipBuffer);
	console.log(`Wrote ${posts.length} posts + posts.db to ${localPath}`);

	const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
	const missing = required.filter((k) => !process.env[k]);
	if (missing.length) {
		console.warn(`Skipping R2 mirror — missing env: ${missing.join(', ')}`);
		return false;
	}

	const r2 = new S3Client({
		region: 'auto',
		endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: process.env.R2_ACCESS_KEY_ID!,
			secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
		}
	});

	const key = r2Key(now);
	await uploadBackup(r2, process.env.R2_BUCKET!, zipBuffer, key);
	console.log(`Mirrored archive to R2: ${key}`);
	return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	runWithHeartbeat(main, process.env.BACKUP_HEARTBEAT_URL).catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
