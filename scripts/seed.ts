import { join } from 'node:path';
import { createDb } from '../src/lib/db';
import { permalink } from '../src/lib/slug';
import { fixtures, imageFixtures } from './fixtures';

const R2_BASE = (process.env.R2_PUBLIC_URL ?? 'https://static.compostmodernism.org').replace(
	/\/$/,
	''
);

// Direct-to-DB seeding: bypasses the SvelteKit server entirely. The image
// ledger needed direct access anyway (no R2 round-trip in dev), and posts go
// through the same `insertPost` that the server uses — which already calls
// `setPostImages` internally — so join rows are created without any HTTP.
//
// You'll need to restart your dev server after seeding so it picks up the
// fresh posts.db (its `defaultDb()` singleton holds an open connection).
async function seed() {
	const db = createDb(join(process.cwd(), 'posts.db'));

	console.log(`Recording ${imageFixtures.length} image ledger entries…`);
	const updateMeta = db.raw.prepare(
		'UPDATE images SET title = ?, alt = ?, caption = ?, credit = ? WHERE id = ?'
	);
	for (const img of imageFixtures) {
		const row = db.recordImage(img.key);
		if (img.title || img.alt || img.caption || img.credit) {
			updateMeta.run(
				img.title ?? null,
				img.alt ?? null,
				img.caption ?? null,
				img.credit ?? null,
				row.id
			);
		}
		console.log(`  ✓ ${img.key}`);
	}

	console.log(`Inserting ${fixtures.length} posts…`);
	for (const [i, fixture] of fixtures.entries()) {
		const body = fixture.body.replaceAll('{{IMG}}', R2_BASE);
		const { slug } = db.insertPost({
			body,
			title: fixture.title ?? null,
			url: fixture.url ?? null,
			tags: fixture.tags ?? []
		});
		const post = db.getPostBySlug(slug);
		if (!post) throw new Error(`failed to read back ${slug}`);

		const label = fixture.title ?? fixture.body.slice(0, 50) + '…';
		const hasImage = fixture.body.includes('{{IMG}}');
		console.log(`  ✓ [${i + 1}/${fixtures.length}] ${label}${hasImage ? ' 🖼' : ''}`);
		console.log(`      → ${permalink(post)}`);

		// Small delay so created_at timestamps differ and posts sort cleanly.
		await new Promise((r) => setTimeout(r, 50));
	}

	const { joins } = db.raw.prepare('SELECT COUNT(*) AS joins FROM post_images').get() as {
		joins: number;
	};
	console.log(`post_images join rows after seed: ${joins}`);

	db.raw.close();
}

seed().catch((err) => {
	console.error(err);
	process.exit(1);
});
