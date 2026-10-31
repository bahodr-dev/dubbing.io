import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import Database from 'better-sqlite3';
import { db, dbPath, uploadsDir } from '../db.js';

// Artifacts are immutable; deletions during backup cause verification to fail.
// Only a verified snapshot is renamed to the final backup directory.
const root = path.resolve(process.env.DB_BACKUP_DIR || path.join(path.dirname(dbPath), 'backups'));
fs.mkdirSync(root, { recursive: true, mode: 0o700 });
const destination = path.join(root, `film-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const staging = `${destination}.incomplete-${randomUUID()}`;
fs.mkdirSync(staging, { mode: 0o700 });
await db.backup(path.join(staging, 'dubbing.db'));
const snapshot = new Database(path.join(staging, 'dubbing.db'), { readonly: true });
const files = new Set();
function collect(value) {
  if (typeof value === 'string' && value.startsWith(`${path.resolve(uploadsDir)}${path.sep}`)) files.add(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
for (const row of snapshot.prepare("SELECT stored_filename FROM media_assets WHERE status = 'ready'").all()) files.add(path.resolve(uploadsDir, row.stored_filename));
const tables = new Set(snapshot.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
for (const [table, column] of [['film_samples', 'file_path'], ['film_requests', 'output_json'], ['film_chunks', 'output_json'], ['cinema_artifacts', 'output_json']]) {
  if (!tables.has(table)) continue;
  for (const row of snapshot.prepare(`SELECT ${column} AS value FROM ${table}`).all()) {
    if (column === 'file_path') collect(row.value);
    else if (row.value) collect(JSON.parse(row.value));
  }
}
snapshot.close();
const mediaRoot = path.join(staging, 'uploads'); fs.mkdirSync(mediaRoot);
const manifest = [];
for (const source of files) {
  if (!source.startsWith(`${path.resolve(uploadsDir)}${path.sep}`)) throw new Error('Backup encountered a file outside the media directory.');
  const relative = path.relative(uploadsDir, source);
  const target = path.join(mediaRoot, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(target)) hash.update(chunk);
  manifest.push({ file: relative, bytes: fs.statSync(target).size, sha256: hash.digest('hex') });
}
fs.writeFileSync(path.join(staging, 'manifest.json'), JSON.stringify({ sourceUploadsDir: uploadsDir, createdAt: new Date().toISOString(), files: manifest }, null, 2));
fs.renameSync(staging, destination);
console.log(`Verified database and media backup: ${destination} (${manifest.length} files)`);
db.close();
