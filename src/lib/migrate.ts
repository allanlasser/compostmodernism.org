import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';

export const MIGRATIONS_DIR = join(process.cwd(), 'migrations');

const FILE_PATTERN = /^(\d{3})_.+\.sql$/;

interface Migration {
	version: number;
	file: string;
	sql: string;
}

function discoverMigrations(dir: string): Migration[] {
	if (!existsSync(dir)) {
		throw new Error(`migrations directory not found: ${dir}`);
	}
	const files = readdirSync(dir).filter((f) => FILE_PATTERN.test(f));
	const migrations = files.map((file) => {
		const version = Number(FILE_PATTERN.exec(file)![1]);
		const sql = readFileSync(join(dir, file), 'utf8');
		return { version, file, sql };
	});
	return migrations.sort((a, b) => a.version - b.version);
}

export function migrate(db: Database.Database, dir: string = MIGRATIONS_DIR): void {
	const current = (db.prepare('PRAGMA user_version').get() as { user_version: number })
		.user_version;
	const pending = discoverMigrations(dir).filter((m) => m.version > current);
	if (!pending.length) return;

	for (const { version, sql } of pending) {
		const apply = db.transaction(() => {
			db.exec(sql);
			// PRAGMA user_version doesn't accept bind parameters, so interpolate the
			// version after validating it's an integer (the regex already guarantees it).
			db.exec(`PRAGMA user_version = ${version}`);
		});
		apply();
	}
}
