import fs from 'fs';
import path from 'path';
import { db, dbPath } from '../db.js';

// Keep snapshots beside the configured persistent database unless an explicit
// off-site staging directory is supplied.
const backupDir = process.env.DB_BACKUP_DIR
  ? path.resolve(process.env.DB_BACKUP_DIR)
  : path.join(path.dirname(dbPath), 'backups');
const keepCount = Number.parseInt(process.env.DB_BACKUP_KEEP_COUNT || '14', 10);

fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = path.join(backupDir, `dubbing-${timestamp}.db`);

await db.backup(target);

const backups = fs.readdirSync(backupDir)
  .filter((name) => name.endsWith('.db'))
  .map((name) => ({ name, path: path.join(backupDir, name), mtime: fs.statSync(path.join(backupDir, name)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

for (const backup of backups.slice(Math.max(keepCount, 1))) {
  fs.unlinkSync(backup.path);
}

console.log(`Database backup created: ${path.basename(target)}`);
