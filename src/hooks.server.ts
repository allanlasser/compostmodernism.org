import { env } from '$env/dynamic/private';

// Bridge $env/dynamic/private → process.env so modules used by both the
// SvelteKit server and CLI scripts (e.g. src/lib/db.ts) see consistent values.
//
// Why: Vite's dev server reads .env files into `$env/dynamic/private` but does
// not populate `process.env` for unprefixed variables. Modules that read from
// `process.env` directly (so they also work under `tsx scripts/*.ts`) would
// otherwise see undefined for those keys at server runtime.
//
// In production (Node adapter behind Docker), env vars typically come from
// docker-compose's env_file and land in process.env directly, so this loop is
// a no-op. The undefined-guard prevents any overwrite of real values.
for (const [key, value] of Object.entries(env)) {
	if (value !== undefined && process.env[key] === undefined) {
		process.env[key] = value;
	}
}
