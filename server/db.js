import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure database directory exists
const dbDir = path.join(__dirname, '..', 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'dubbing.db');
export const db = new Database(dbPath);

// Enable WAL mode for high performance & concurrency
db.pragma('journal_mode = WAL');

// Initialize database schema
export function initDatabase() {
  // Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT,
      provider TEXT DEFAULT 'email',
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Projects Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      source_url TEXT,
      thumbnail_url TEXT,
      original_language TEXT DEFAULT 'en',
      target_language TEXT DEFAULT 'uz',
      status TEXT DEFAULT 'ready',
      duration REAL DEFAULT 0,
      segments_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  console.log('✅ SQLite database initialized at:', dbPath);
}
