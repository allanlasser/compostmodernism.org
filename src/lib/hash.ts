import { createHash } from 'node:crypto';

// Node-only helpers. Keep these out of `src/lib/slug.ts` so the slug module
// stays safe to import from client code; see NOTES.md.

export function hashSlug(timestamp: number): string {
	return createHash('md5').update(String(timestamp)).digest('hex').slice(0, 8);
}
