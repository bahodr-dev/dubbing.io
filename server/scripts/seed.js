import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.join(__dirname, '..', '..', 'database');
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const dbPath = path.join(dbDir, 'dubbing.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

console.log('🌱 Seeding database at:', dbPath);

// Create Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    name TEXT,
    provider TEXT DEFAULT 'email',
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS voices (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    language TEXT NOT NULL,
    language_code TEXT NOT NULL,
    style TEXT NOT NULL,
    gender TEXT NOT NULL,
    tone TEXT NOT NULL,
    preview_url TEXT,
    tags_json TEXT,
    recommended INTEGER DEFAULT 0,
    is_custom INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

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
    file_size TEXT,
    video_quality TEXT DEFAULT '1080p',
    segments_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

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
    id: 'voice-madina',
    name: 'Madina',
    language: 'Uzbek',
    language_code: 'uz',
    style: 'Warm',
    gender: 'female',
    tone: 'Calm, soothing, podcast and audiobook cadence',
    tags_json: JSON.stringify(['Audiobook', 'Meditation', 'Podcast']),
    recommended: 0,
    is_custom: 0,
  },
  {
    id: 'voice-sophia',
    name: 'Sophia',
    language: 'English',
    language_code: 'en',
    style: 'Natural',
    gender: 'female',
    tone: 'Crystal clear American cadence, engaging broadcast rhythm',
    tags_json: JSON.stringify(['Tech', 'Keynote', 'Education']),
    recommended: 1,
    is_custom: 0,
  },
  {
    id: 'voice-david',
    name: 'David',
    language: 'English',
    language_code: 'en',
    style: 'Professional',
    gender: 'male',
    tone: 'Authoritative, calm, cinematic narration tone',
    tags_json: JSON.stringify(['Corporate', 'Cinema', 'Documentary']),
    recommended: 1,
    is_custom: 0,
  },
  {
    id: 'voice-elena',
    name: 'Elena',
    language: 'Spanish',
    language_code: 'es',
    style: 'Conversational',
    gender: 'female',
    tone: 'Lively, warm Latin American cadence, high articulation',
    tags_json: JSON.stringify(['Entertainment', 'Vlog', 'Commercial']),
    recommended: 0,
    is_custom: 0,
  },
  {
    id: 'voice-marcus',
    name: 'Marcus',
    language: 'German',
    language_code: 'de',
    style: 'Professional',
    gender: 'male',
    tone: 'Precise, articulate, executive presentation resonance',
    tags_json: JSON.stringify(['Business', 'Engineering', 'Academic']),
    recommended: 0,
    is_custom: 0,
  }
];

const insertVoice = db.prepare(`
  INSERT OR IGNORE INTO voices (
    id, name, language, language_code, style, gender, 
    tone, tags_json, recommended, is_custom
  ) VALUES (
    @id, @name, @language, @language_code, @style, @gender, 
    @tone, @tags_json, @recommended, @is_custom
  )
`);

const insertMany = db.transaction((voices) => {
  for (const voice of voices) {
    insertVoice.run(voice);
  }
});

insertMany(INITIAL_VOICES);

console.log('✅ Seed completed successfully with initial studio voice models!');
