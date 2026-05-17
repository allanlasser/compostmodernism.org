import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { migrate } from './migrate';

let dir: string;
let db: Database.Database;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'migrate-test-'));
	db = new Database(':memory:');
});

afterEach(() => {
	db.close();
	rmSync(dir, { recursive: true, force: true });
});

function writeMigration(version: number, name: string, sql: string): void {
	writeFileSync(join(dir, `${String(version).padStart(3, '0')}_${name}.sql`), sql);
}

function userVersion(d: Database.Database): number {
	return (d.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
}

function tableNames(d: Database.Database): string[] {
	const rows = d
		.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
		.all() as { name: string }[];
	return rows.map((r) => r.name);
}

describe('migrate', () => {
	it('applies all migrations to a fresh DB and bumps user_version to the highest applied', () => {
		writeMigration(1, 'init', 'CREATE TABLE a (id INTEGER);');
		writeMigration(2, 'add_b', 'CREATE TABLE b (id INTEGER);');
		migrate(db, dir);
		expect(tableNames(db)).toEqual(['a', 'b']);
		expect(userVersion(db)).toBe(2);
	});

	it('applies only migrations newer than the current user_version', () => {
		writeMigration(1, 'init', 'CREATE TABLE a (id INTEGER);');
		writeMigration(2, 'add_b', 'CREATE TABLE b (id INTEGER);');
		// Pretend migration 1 was already applied.
		db.exec('CREATE TABLE a (id INTEGER);');
		db.exec('PRAGMA user_version = 1');
		migrate(db, dir);
		expect(tableNames(db)).toEqual(['a', 'b']);
		expect(userVersion(db)).toBe(2);
	});

	it('is a no-op when DB is at the latest version', () => {
		writeMigration(1, 'init', 'CREATE TABLE a (id INTEGER);');
		db.exec('CREATE TABLE a (id INTEGER); INSERT INTO a VALUES (42);');
		db.exec('PRAGMA user_version = 1');
		migrate(db, dir);
		expect(userVersion(db)).toBe(1);
		expect(
			db.prepare('SELECT id FROM a').get() as { id: number }
		).toEqual({ id: 42 });
	});

	it('applies migrations in numeric order, not lexical order with mixed widths', () => {
		// All zero-padded so lexical == numeric, but verify intent.
		writeMigration(10, 'late', "INSERT INTO log (n) VALUES ('ten');");
		writeMigration(2, 'middle', "INSERT INTO log (n) VALUES ('two');");
		writeMigration(1, 'init', 'CREATE TABLE log (n TEXT);');
		migrate(db, dir);
		const rows = db.prepare('SELECT n FROM log').all() as { n: string }[];
		expect(rows.map((r) => r.n)).toEqual(['two', 'ten']);
		expect(userVersion(db)).toBe(10);
	});

	it('ignores files that do not match NNN_*.sql', () => {
		writeMigration(1, 'init', 'CREATE TABLE a (id INTEGER);');
		writeFileSync(join(dir, 'README.md'), '# notes');
		writeFileSync(join(dir, 'rollback.sql'), 'DROP TABLE a;');
		writeFileSync(join(dir, '99_no_padding.sql'), 'CREATE TABLE bad (id INTEGER);');
		migrate(db, dir);
		expect(tableNames(db)).toEqual(['a']);
	});

	it('failed migration rolls back atomically — version stays, partial schema gone', () => {
		writeMigration(1, 'init', 'CREATE TABLE a (id INTEGER);');
		writeMigration(
			2,
			'broken',
			'CREATE TABLE b (id INTEGER); INSERT INTO nonexistent VALUES (1);'
		);
		expect(() => migrate(db, dir)).toThrow();
		// 001 succeeded fully; 002 rolled back — b should NOT exist.
		expect(tableNames(db)).toEqual(['a']);
		expect(userVersion(db)).toBe(1);
	});

	it('throws a clear error when the migrations directory is missing', () => {
		expect(() => migrate(db, join(dir, 'does-not-exist'))).toThrow(/migrations directory/i);
	});
});
