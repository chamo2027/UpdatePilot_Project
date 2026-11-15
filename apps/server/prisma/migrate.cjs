const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url?.startsWith('file:') || url.length <= 5 || url.includes('?')) {
  throw new Error('DATABASE_URL must point to a SQLite file, for example file:./dev.db.');
}

// Pre-create new SQLite files so Prisma can open them on Windows.
const databasePath = resolve(__dirname, url.slice(5));
if (!existsSync(databasePath)) {
  new DatabaseSync(databasePath).close();
}
const result = spawnSync(process.execPath, [require.resolve('prisma'), 'migrate', 'deploy'], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
