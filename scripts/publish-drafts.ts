/**
 * Publishes imported draft posts (draft=1 → draft=0) so they appear
 * in the public feed and RSS.
 *
 * Usage:
 *   npx tsx scripts/publish-drafts.ts               # all drafts
 *   npx tsx scripts/publish-drafts.ts --before 2024-01-01  # only pre-2024 posts
 *   npx tsx scripts/publish-drafts.ts --dry-run     # preview only
 */

import { join } from 'node:path';
import { createDb } from '../src/lib/db.ts';
import { permalink } from '../src/lib/slug.ts';

const cliArgs = process.argv.slice(2);
const dryRun = cliArgs.includes('--dry-run');

function getFlag(name: string): string | undefined {
	const eqIdx = cliArgs.findIndex((a) => a.startsWith(`${name}=`));
	if (eqIdx !== -1) return cliArgs[eqIdx].slice(name.length + 1);
	const idx = cliArgs.indexOf(name);
	if (idx !== -1) return cliArgs[idx + 1];
	return undefined;
}

const beforeArg = getFlag('--before');
const beforeTs = beforeArg ? new Date(beforeArg).getTime() : undefined;

if (beforeTs !== undefined && Number.isNaN(beforeTs)) {
	console.error(`Invalid --before value: "${beforeArg}". Use ISO date format, e.g. 2024-01-01.`);
	process.exit(1);
}

const db = createDb(join(process.cwd(), 'posts.db'));

async function main() {
	const drafts = db.getDraftPosts({ limit: 10000 });

	const toPublish = beforeTs ? drafts.filter((p) => p.created_at < beforeTs) : drafts;

	console.log(`${drafts.length} draft(s) total, ${toPublish.length} eligible.`);
	if (beforeTs) console.log(`Filter: created_at < ${new Date(beforeTs).toISOString()}`);
	if (dryRun) console.log('[DRY RUN — no writes]\n');
	else console.log('');

	let count = 0;
	for (const post of toPublish) {
		const url = permalink(post);
		if (dryRun) {
			console.log(`[dry-run] would publish: ${url}  "${post.title ?? '(untitled)'}"`);
		} else {
			db.updatePost(post.slug, { body: post.body, draft: 0 });
			console.log(`✓ published: ${url}  "${post.title ?? '(untitled)'}"`);
		}
		count++;
	}

	console.log(`\n${count} post(s) ${dryRun ? 'would be published' : 'published'}.`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
