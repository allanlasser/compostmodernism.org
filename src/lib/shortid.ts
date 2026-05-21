// The encoder config (alphabet + minLength) is effectively a migration:
// once any short link has been shared, changing these values will break it.
// Before any change here, run `tsx scripts/freeze-shortlink-tokens.ts` to
// persist every current token into `shortlink_redirects` first. See NOTES.md.
import Sqids from 'sqids';

const sqids = new Sqids({
	alphabet: 'abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ',
	minLength: 4
});

export function encodeId(id: number): string {
	return sqids.encode([id]);
}

export function decodeId(token: string): number | null {
	if (!token) return null;
	const arr = sqids.decode(token);
	if (arr.length !== 1) return null;
	const id = arr[0];
	return Number.isInteger(id) && id > 0 ? id : null;
}
