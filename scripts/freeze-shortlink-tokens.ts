import { join } from 'node:path';
import { createDb } from '../src/lib/db';
import { freezeShortlinkTokens } from '../src/lib/shortid-freeze';

const path = join(process.cwd(), 'posts.db');
const db = createDb(path);
const written = freezeShortlinkTokens(db);
db.raw.close();

console.log(`Froze ${written} shortlink token${written === 1 ? '' : 's'} into ${path}`);
