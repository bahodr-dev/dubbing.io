import fs from 'fs';
import path from 'path';
import { db, initDatabase, uploadsDir } from '../db.js';
import { createInvite } from '../repositories/betaInviteRepository.js';

initDatabase();

const args = process.argv.slice(2);
const command = args[0];
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : null;
};

function usage(exitCode = 0) {
  console.log(`Usage:
  npm run beta -- invite --email user@example.com [--days 7]
  npm run beta -- credit --email user@example.com --minutes 30
  npm run beta -- status
  npm run beta -- storage
  npm run beta -- cleanup-orphans --dry-run`);
  process.exitCode = exitCode;
}

function bytesOnDisk(root) {
  if (!fs.existsSync(root)) return 0;
  return fs.readdirSync(root, { withFileTypes: true }).reduce((total, entry) => {
    const target = path.join(root, entry.name);
    return total + (entry.isDirectory() ? bytesOnDisk(target) : fs.statSync(target).size);
  }, 0);
}

if (command === 'invite') {
  const email = flag('email');
  const days = Number(flag('days') || 7);
  if (!email || !Number.isFinite(days) || days <= 0) usage(1);
  else {
    const invite = createInvite({ email, expiresAt: Date.now() + days * 86_400_000 });
    console.log(JSON.stringify({ email: invite.email, inviteToken: invite.token, expiresAt: new Date(invite.expiresAt).toISOString() }, null, 2));
  }
} else if (command === 'credit') {
  const email = String(flag('email') || '').trim().toLowerCase();
  const minutes = Number(flag('minutes'));
  if (!email || !Number.isFinite(minutes) || minutes <= 0) usage(1);
  else {
    const result = db.prepare(`
      UPDATE users SET minutes_balance = ROUND(COALESCE(minutes_balance, 0) + ?, 6), updated_at = CURRENT_TIMESTAMP
      WHERE email = ?
    `).run(minutes, email);
    if (result.changes !== 1) throw new Error(`User not found: ${email}`);
    const user = db.prepare('SELECT email, minutes_balance FROM users WHERE email = ?').get(email);
    console.log(JSON.stringify({ email: user.email, minutesBalance: user.minutes_balance }, null, 2));
  }
} else if (command === 'status') {
  const users = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  const invites = db.prepare(`SELECT
    SUM(CASE WHEN used_at IS NULL AND expires_at >= ? THEN 1 ELSE 0 END) AS active,
    SUM(CASE WHEN used_at IS NOT NULL THEN 1 ELSE 0 END) AS used
    FROM beta_invites`).get(Date.now());
  const jobs = db.prepare('SELECT status, COUNT(*) AS count FROM dubbing_jobs GROUP BY status').all();
  console.log(JSON.stringify({ users, invites: { active: invites.active || 0, used: invites.used || 0 }, jobs }, null, 2));
} else if (command === 'storage') {
  const stats = fs.statfsSync(uploadsDir);
  const usedBytes = bytesOnDisk(uploadsDir);
  const diskUsedPercent = Math.round((1 - stats.bavail / stats.blocks) * 1000) / 10;
  const warningAt = Number(process.env.DISK_WARNING_PERCENT || 70);
  const criticalAt = Number(process.env.DISK_CRITICAL_PERCENT || 85);
  console.log(JSON.stringify({ uploadsDir, mediaBytes: usedBytes, diskUsedPercent, level: diskUsedPercent >= criticalAt ? 'critical' : diskUsedPercent >= warningAt ? 'warning' : 'ok' }, null, 2));
} else if (command === 'cleanup-orphans') {
  const dryRun = args.includes('--dry-run');
  if (!dryRun && !args.includes('--confirm')) throw new Error('Refusing deletion without --confirm. Use --dry-run first.');
  const registered = new Set(db.prepare('SELECT stored_filename FROM media_assets').all().map((row) => row.stored_filename));
  const orphans = fs.readdirSync(uploadsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== '.gitkeep' && !registered.has(entry.name))
    .map((entry) => entry.name);
  if (!dryRun) for (const filename of orphans) fs.unlinkSync(path.join(uploadsDir, filename));
  console.log(JSON.stringify({ dryRun, count: orphans.length, files: orphans }, null, 2));
} else {
  usage(command ? 1 : 0);
}
