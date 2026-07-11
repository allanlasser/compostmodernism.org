/**
 * Imports posts from allanlasser.com's Sanity CMS into the local SQLite DB.
 * Posts are inserted as drafts (draft=1) and backdated to their original publishedAt date.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-sanity.ts [--dry-run] [--id <sanityDocId>]
 *
 * Required env vars (from .env.local):
 *   SANITY_PROJECT, SANITY_DATASET, SANITY_TOKEN
 *   R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL
 */

import { createClient } from '@sanity/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createDb } from '../src/lib/db.ts';
import { slugify } from '../src/lib/slug.ts';
import { hashSlug } from '../src/lib/hash.ts';
import { portableTextToMarkdown } from '../src/lib/portable-text.ts';
import type { SanityImageBlock } from '../src/lib/portable-text.ts';

// ── CLI flags ──────────────────────────────────────────────────────────────────

const cliArgs = process.argv.slice(2);
const dryRun = cliArgs.includes('--dry-run');

function getFlag(name: string): string | undefined {
	const eqIdx = cliArgs.findIndex((a) => a.startsWith(`${name}=`));
	if (eqIdx !== -1) return cliArgs[eqIdx].slice(name.length + 1);
	const idx = cliArgs.indexOf(name);
	if (idx !== -1) return cliArgs[idx + 1];
	return undefined;
}
const targetId = getFlag('--id');

// ── Environment ────────────────────────────────────────────────────────────────

const {
	SANITY_PROJECT,
	SANITY_DATASET,
	SANITY_TOKEN,
	R2_ACCOUNT_ID,
	R2_BUCKET,
	R2_ACCESS_KEY_ID,
	R2_SECRET_ACCESS_KEY,
	R2_PUBLIC_URL
} = process.env;

if (!SANITY_PROJECT || !SANITY_DATASET || !SANITY_TOKEN) {
	console.error('Missing required env vars: SANITY_PROJECT, SANITY_DATASET, SANITY_TOKEN');
	process.exit(1);
}
if (!dryRun && (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_URL)) {
	console.error('Missing required R2 env vars (R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL)');
	process.exit(1);
}

// ── Clients ────────────────────────────────────────────────────────────────────

const sanity = createClient({
	projectId: SANITY_PROJECT,
	dataset: SANITY_DATASET,
	apiVersion: '2022-01-01',
	token: SANITY_TOKEN,
	useCdn: false,
	perspective: 'published'
});

const r2 = dryRun
	? null
	: new S3Client({
			region: 'auto',
			endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: R2_ACCESS_KEY_ID!,
				secretAccessKey: R2_SECRET_ACCESS_KEY!
			}
	  });

const db = dryRun ? null : createDb(join(process.cwd(), 'posts.db'));

// ── GROQ query ─────────────────────────────────────────────────────────────────

const QUERY = `*[_type == "post" && defined(publishedAt)] | order(publishedAt asc) {
  _id,
  "slug": slug.current,
  publishedAt,
  title,
  source->{url, title, type, author},
  body[]{
    _type != "image" && _type != "reference" => @,
    _type == "image" => {
      ...,
      "assetId": asset->_id,
      "assetUrl": asset->url
    },
    _type == "reference" => @->{
      _type,
      title,
      body,
      images[]{ alt, "assetUrl": asset->url, "assetId": asset->_id }
    }
  }
}`;

// ── Helpers ────────────────────────────────────────────────────────────────────

// Sanity slugs include a date prefix (e.g. "2023-05-14-on-digital-gardens").
// Strip it so the URL path doesn't repeat the date.
function stripDatePrefix(slug: string): string {
	return slug.replace(/^\d{4}-\d{2}-\d{2}-?/, '');
}

function resolveSlug(sanitySlug: string | undefined, title: string | undefined, publishedAt: string): string {
	if (sanitySlug) {
		const stripped = stripDatePrefix(sanitySlug).trim();
		if (stripped) return stripped;
	}
	if (title) return slugify(title);
	return hashSlug(new Date(publishedAt).getTime());
}

function r2KeyForAsset(assetId: string, publishedAt: string): string {
	const d = new Date(publishedAt);
	const year = d.getUTCFullYear();
	const month = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');
	const hash = createHash('md5').update(assetId).digest('hex').slice(0, 8);
	return `images/${year}/${month}/${day}/${hash}.webp`;
}

async function ensureImage(
	block: { assetUrl?: string; assetId?: string },
	publishedAt: string
): Promise<string> {
	const { assetUrl, assetId } = block;
	if (!assetUrl || !assetId) {
		console.warn('    ⚠ image block missing assetUrl or assetId — skipping');
		return '';
	}

	const key = r2KeyForAsset(assetId, publishedAt);
	const publicUrl = `${R2_PUBLIC_URL}/${key}`;

	if (dryRun) {
		console.log(`    [dry-run] image ${assetId.slice(-12)} → ${key}`);
		return publicUrl;
	}

	// Idempotent: skip if already in the images ledger
	const existing = db!.raw.prepare('SELECT key FROM images WHERE key = ?').get(key);
	if (existing) {
		console.log(`    ↩ image already uploaded: ${key}`);
		return publicUrl;
	}

	// Fetch from Sanity CDN
	const resp = await fetch(assetUrl);
	if (!resp.ok) throw new Error(`Sanity CDN returned ${resp.status} for ${assetUrl}`);
	const raw = Buffer.from(await resp.arrayBuffer());

	// Re-encode as WebP (same pipeline as src/routes/api/upload/+server.ts)
	const processed = await sharp(raw)
		.rotate()
		.resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
		.webp({ quality: 82 })
		.toBuffer();

	// Upload to R2
	await r2!.send(
		new PutObjectCommand({
			Bucket: R2_BUCKET!,
			Key: key,
			Body: processed,
			ContentType: 'image/webp'
		})
	);

	// Record in local ledger
	db!.recordImage(key);
	console.log(`    ✓ uploaded ${key}`);
	return publicUrl;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
	console.log(`Fetching posts from Sanity [project=${SANITY_PROJECT} dataset=${SANITY_DATASET}]…`);
	if (dryRun) console.log('[DRY RUN — no writes]\n');

	const posts: SanityPost[] = await sanity.fetch(QUERY, targetId ? { id: targetId } : {});
	const filtered = targetId ? posts.filter((p) => p._id === targetId) : posts;
	console.log(`${filtered.length} post(s) found.\n`);

	let imported = 0, skipped = 0, errored = 0;

	for (const post of filtered) {
		const slug = resolveSlug(post.slug, post.title ?? undefined, post.publishedAt);
		const ts = new Date(post.publishedAt).getTime();
		console.log(`→ ${post._id.slice(-12)}  ${post.publishedAt.slice(0, 10)}  "${slug}"`);

		if (!dryRun && db!.slugTaken(slug)) {
			console.log('  ⊘ skipped (slug already in DB)');
			skipped++;
			continue;
		}

		try {
			const imageHandler = async (block: SanityImageBlock) =>
				ensureImage(block, post.publishedAt);

			const body = await portableTextToMarkdown(post.body ?? [], imageHandler);

			let url: string | null = null;
			let finalBody = body;

			if (post.source) {
				if (post.source.url) {
					url = post.source.url;
				} else if (post.source.title) {
					const byLine = post.source.author ? ` by ${post.source.author}` : '';
					finalBody += `\n\n---\n_Source: ${post.source.title}${byLine}._`;
				}
			}

			if (dryRun) {
				console.log(
					`  [dry-run] title="${post.title ?? '(none)'}" url=${url ?? '(none)'} body=${finalBody.length}ch`
				);
				imported++;
				continue;
			}

			const result = db!.insertPost({
				slug,
				title: post.title ?? null,
				body: finalBody,
				url,
				created_at: ts,
				draft: 1
			});

			console.log(`  ✓ inserted id=${result.id}`);
			imported++;
		} catch (err) {
			console.error(`  ✗ error:`, err);
			errored++;
		}
	}

	console.log(`\nDone. imported=${imported} skipped=${skipped} errors=${errored}`);
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface SanityPost {
	_id: string;
	slug?: string;
	publishedAt: string;
	title?: string | null;
	source?: {
		url?: string;
		title?: string;
		type?: string;
		author?: string;
	} | null;
	body?: unknown[];
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
