import { getDatabaseMigrationStatus, initDatabase } from '../db.js';

initDatabase();

const status = getDatabaseMigrationStatus();
console.log(`Database schema: ${status.currentVersion || 'baseline'}`);
console.log(`Latest schema: ${status.latestVersion || 'baseline'}`);
console.log(`Applied migrations: ${status.appliedCount}`);
console.log(`Pending migrations: ${status.pending.length}`);

if (status.pending.length > 0) {
  console.error(`Pending migration IDs: ${status.pending.join(', ')}`);
  process.exitCode = 1;
}
