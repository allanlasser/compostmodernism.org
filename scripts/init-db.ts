import { join } from 'node:path';
import { createDb } from '../src/lib/db';

const path = join(process.cwd(), 'posts.db');
const db = createDb(path);
db.raw.close();

console.log(`Database initialised at ${path}`);
