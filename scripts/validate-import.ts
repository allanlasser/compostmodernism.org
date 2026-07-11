/**
 * Validates all draft posts (draft=1) imported from Sanity.
 * Checks for: non-empty body, no Sanity residue, R2-hosted images, correct backdating.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/validate-import.ts
 */

import { join } from 'node:path';
import { createDb } from '../src/lib/db.ts';

const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');

if (!R2_PUBLIC_URL) {
	console.error('Missing R2_PUBLIC_URL env var');
	process.exit(1);
}

const db = createDb(join(process.cwd(), 'posts.db'));

// Patterns that indicate unconverted Sanity content left behind
const SANITY_RESIDUE = [/_type"|_ref"|sanity\.io/];

// Extracts all markdown image URLs from body
function extractImageUrls(body: string): string[] {
	const urls: string[] = [];
	for (const match of body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
		urls.push(match[1]);
	}
	return urls;
}

async function checkImageUrl(url: string): Promise<boolean> {
	try {
		const resp = await fetch(url, { method: 'HEAD' });
		return resp.ok;
	} catch {
		return false;
	}
}

// Limit concurrent HEAD requests so we don't hammer R2
async function checkImages(urls: string[], concurrency = 5): Promise<string[]> {
	const broken: string[] = [];
	for (let i = 0; i < urls.length; i += concurrency) {
		const batch = urls.slice(i, i + concurrency);
		const results = await Promise.all(batch.map(async (url) => ({ url, ok: await checkImageUrl(url) })));
		for (const { url, ok } of results) {
			if (!ok) broken.push(url);
		}
	}
	return broken;
}

interface CheckResult {
	slug: string;
	date: string;
	issues: string[];
}

async function main() {
	const drafts = db.getDraftPosts({ limit: 1000 });
	console.log(`Validating ${drafts.length} draft post(s)…\n`);

	const results: CheckResult[] = [];
	const now = Date.now();

	for (const post of drafts) {
		const issues: string[] = [];
		const date = new Date(post.created_at).toISOString().slice(0, 10);

		// 1. Non-empty body
		if (!post.body || !post.body.trim()) {
			issues.push('body is empty');
		}

		// 2. No Sanity residue
		if (SANITY_RESIDUE.some((re) => re.test(post.body))) {
			issues.push('body contains Sanity tokens (_type, _ref, or sanity.io)');
		}

		// 3. Images are R2-hosted (not Sanity CDN)
		const imageUrls = extractImageUrls(post.body);
		const nonR2 = imageUrls.filter((u) => !u.startsWith(R2_PUBLIC_URL));
		if (nonR2.length) {
			issues.push(`${nonR2.length} image(s) point to non-R2 URL: ${nonR2.join(', ')}`);
		}

		// 4. R2 images are reachable (HEAD request)
		const r2Urls = imageUrls.filter((u) => u.startsWith(R2_PUBLIC_URL));
		if (r2Urls.length) {
			const broken = await checkImages(r2Urls);
			if (broken.length) {
				issues.push(`${broken.length} R2 image(s) returned non-200: ${broken.join(', ')}`);
			}
		}

		// 5. created_at is in the past (backdating confirmed)
		if (post.created_at >= now) {
			issues.push(`created_at (${post.created_at}) is not in the past`);
		}

		results.push({ slug: post.slug, date, issues });
	}

	// Report
	let passed = 0, failed = 0;
	for (const { slug, date, issues } of results) {
		if (issues.length === 0) {
			console.log(`✓ ${date}  ${slug}`);
			passed++;
		} else {
			console.log(`✗ ${date}  ${slug}`);
			for (const issue of issues) console.log(`    — ${issue}`);
			failed++;
		}
	}

	console.log(`\nSummary: ${passed} passed, ${failed} failed out of ${results.length} total.`);
	if (failed > 0) process.exit(1);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
