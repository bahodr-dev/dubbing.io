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

// Ensure uploads directory exists
export const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'dubbing.db');
export const db = new Database(dbPath);

// Enable WAL mode for high performance & concurrency
db.pragma('journal_mode = WAL');

const INITIAL_VOICES = [
  {
    id: 'voice-farrux',
    name: 'Farrux',
    language: 'Uzbek',
    language_code: 'uz',
    style: 'Professional',
    gender: 'male',
    tone: 'Deep resonance, accurate cadence, broadcast clarity',
    tags_json: JSON.stringify(['Studio', 'Documentary', 'Business']),
    recommended: 1,
    is_custom: 0,
  },
  {
    id: 'voice-dilnoza',
    name: 'Dilnoza',
    language: 'Uzbek',
    language_code: 'uz',
    style: 'Natural',
    gender: 'female',
    tone: 'Warm, expressive, high articulation',
    tags_json: JSON.stringify(['Education', 'Storytelling', 'Vlog']),
    recommended: 1,
    is_custom: 0,
  },
  {
    id: 'voice-jasur',
    name: 'Jasur',
    language: 'Uzbek',
    language_code: 'uz',
    style: 'Conversational',
    gender: 'male',
    tone: 'Youthful, energetic, modern conversational flow',
    tags_json: JSON.stringify(['Social Media', 'Shorts', 'Gaming']),
    recommended: 0,
    is_custom: 0,
  },
  {
    id: 'voice-sophia',
    name: 'Sophia',
    language: 'English (US)',
    language_code: 'en',
    style: 'Natural',
    gender: 'female',
    tone: 'Crystal clear, confident, and professional pacing',
    tags_json: JSON.stringify(['Tech', 'Keynote', 'Explainer']),
    recommended: 1,
    is_custom: 0,
  },
  {
    id: 'voice-david',
    name: 'David',
    language: 'English (US)',
    language_code: 'en',
    style: 'Professional',
    gender: 'male',
    tone: 'Authoritative, grounded, cinematic texture',
    tags_json: JSON.stringify(['Commercial', 'Podcast', 'Trailer']),
    recommended: 0,
    is_custom: 0,
  },
  {
    id: 'voice-elena',
    name: 'Elena',
    language: 'Spanish',
    language_code: 'es',
    style: 'Warm',
    gender: 'female',
    tone: 'Melodic, authentic European/Latin cadence',
    tags_json: JSON.stringify(['Creative', 'Narrative', 'Lifestyle']),
    recommended: 1,
    is_custom: 0,
  },
  {
    id: 'voice-marcus',
    name: 'Marcus',
    language: 'German',
    language_code: 'de',
    style: 'Professional',
    gender: 'male',
    tone: 'Precise, articulate, neutral accent',
    tags_json: JSON.stringify(['Technical', 'Industrial', 'Keynote']),
    recommended: 0,
    is_custom: 0,
  },
  {
    id: 'voice-chloe',
    name: 'Chloé',
    language: 'French',
    language_code: 'fr',
    style: 'Natural',
    gender: 'female',
    tone: 'Smooth, sophisticated, natural breathing rhythm',
    tags_json: JSON.stringify(['Luxury', 'Cinema', 'Interview']),
    recommended: 0,
    is_custom: 0,
  },
  {
    id: 'voice-kenji',
    name: 'Kenji',
    language: 'Japanese',
    language_code: 'ja',
    style: 'Dynamic',
    gender: 'male',
    tone: 'Polite, energetic, Tokyo standard dialect',
    tags_json: JSON.stringify(['Gaming', 'Anime', 'Tech Demo']),
    recommended: 1,
    is_custom: 0,
  },
  {
    id: 'voice-amina',
    name: 'Amina',
    language: 'Arabic',
    language_code: 'ar',
    style: 'Narrative',
    gender: 'female',
    tone: 'Modern Standard Arabic, eloquent and poised',
    tags_json: JSON.stringify(['News', 'Documentary', 'Brand']),
    recommended: 0,
    is_custom: 0,
  },
];

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
      description TEXT,
      source_url TEXT,
      thumbnail_url TEXT,
      original_language TEXT DEFAULT 'en',
      target_language TEXT DEFAULT 'uz',
      voice_id TEXT DEFAULT 'voice-farrux',
      status TEXT DEFAULT 'ready',
      duration REAL DEFAULT 0,
      file_size TEXT DEFAULT '12.4 MB',
      video_quality TEXT DEFAULT '1080p',
      segments_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Voices Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS voices (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      language TEXT NOT NULL,
      language_code TEXT NOT NULL,
      style TEXT DEFAULT 'Natural',
      gender TEXT DEFAULT 'male',
      tone TEXT,
      preview_url TEXT,
      tags_json TEXT,
      recommended INTEGER DEFAULT 0,
      is_custom INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default neural voices if table is empty
  const count = db.prepare('SELECT COUNT(*) as count FROM voices').get().count;
  if (count === 0) {
    const insertVoice = db.prepare(`
      INSERT INTO voices (
        id, name, language, language_code, style, gender, 
        tone, tags_json, recommended, is_custom
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((voices) => {
      for (const v of voices) {
        insertVoice.run(
          v.id, v.name, v.language, v.language_code, v.style,
          v.gender, v.tone, v.tags_json, v.recommended, v.is_custom
        );
      }
    });

    insertMany(INITIAL_VOICES);
    console.log(`🎙️ Seeded ${INITIAL_VOICES.length} neural voice profiles into database.`);
  }

  console.log('✅ SQLite database initialized at:', dbPath);
}
