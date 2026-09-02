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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // OAuth Accounts Table (Supports Google, GitHub, Microsoft linked to user)
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      provider_email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(provider, provider_account_id),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // OAuth State Table (Secure PKCE & state verification against CSRF)
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      code_verifier TEXT,
      redirect_url TEXT,
      expires_at INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Auto-migrate schema for backward compatibility
  try {
    const userColumns = db.prepare(`PRAGMA table_info(users)`).all().map(c => c.name);
    if (!userColumns.includes('updated_at')) {
      db.exec(`ALTER TABLE users ADD COLUMN updated_at DATETIME`);
    }
  } catch (err) {
    console.error('Migration error adding updated_at:', err);
  }

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

  // Auto-migrate schema for backward compatibility
  try {
    const projectColumns = db.prepare(`PRAGMA table_info(projects)`).all().map(c => c.name);
    const requiredCols = [
      { name: 'description', type: 'TEXT' },
      { name: 'voice_id', type: "TEXT DEFAULT 'voice-farrux'" },
      { name: 'file_size', type: "TEXT DEFAULT '12.4 MB'" },
      { name: 'video_quality', type: "TEXT DEFAULT '1080p'" },
    ];
    for (const col of requiredCols) {
      if (!projectColumns.includes(col.name)) {
        db.exec(`ALTER TABLE projects ADD COLUMN ${col.name} ${col.type}`);
      }
    }
  } catch (_) {}

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

    // Private Media Assets Table (Enforces strict user ownership)
    db.exec(`
      CREATE TABLE IF NOT EXISTS media_assets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT,
        original_filename TEXT NOT NULL,
        stored_filename TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        media_type TEXT DEFAULT 'video',
        status TEXT DEFAULT 'ready',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_media_assets_user_id ON media_assets (user_id);
      CREATE INDEX IF NOT EXISTS idx_media_assets_project_id ON media_assets (project_id);
    `);

    // Orders & Subscriptions Table
    db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        plan_name TEXT NOT NULL,
        billing_cycle TEXT DEFAULT 'monthly',
        amount_uzs INTEGER NOT NULL,
        amount_usd REAL NOT NULL,
        minutes_credited REAL NOT NULL,
        provider TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
    `);

    // Payme Transactions Table (JSON-RPC 2.0 State Machine)
    db.exec(`
      CREATE TABLE IF NOT EXISTS payme_transactions (
        id TEXT PRIMARY KEY,
        payme_id TEXT UNIQUE NOT NULL,
        order_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        state INTEGER NOT NULL,
        reason INTEGER,
        create_time INTEGER NOT NULL,
        perform_time INTEGER DEFAULT 0,
        cancel_time INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_payme_trans_payme_id ON payme_transactions (payme_id);
      CREATE INDEX IF NOT EXISTS idx_payme_trans_order_id ON payme_transactions (order_id);
    `);

    // Click Transactions Table (SHOP API State Machine)
    db.exec(`
      CREATE TABLE IF NOT EXISTS click_transactions (
        id TEXT PRIMARY KEY,
        click_trans_id TEXT UNIQUE NOT NULL,
        service_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        merchant_trans_id TEXT NOT NULL,
        amount REAL NOT NULL,
        action INTEGER NOT NULL,
        error INTEGER DEFAULT 0,
        error_note TEXT,
        sign_time TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_click_trans_click_id ON click_transactions (click_trans_id);
      CREATE INDEX IF NOT EXISTS idx_click_trans_order_id ON click_transactions (order_id);
    `);

    // Auto-migrate user table for subscription plan and balance
    try {
      const userColumns = db.prepare(`PRAGMA table_info(users)`).all().map(c => c.name);
      if (!userColumns.includes('plan')) {
        db.exec(`ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free'`);
      }
      if (!userColumns.includes('minutes_balance')) {
        db.exec(`ALTER TABLE users ADD COLUMN minutes_balance REAL DEFAULT 5.0`);
      }
      if (!userColumns.includes('subscription_expires_at')) {
        db.exec(`ALTER TABLE users ADD COLUMN subscription_expires_at DATETIME`);
      }
    } catch (_) {}

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
