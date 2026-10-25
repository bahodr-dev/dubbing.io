import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { applyMigrations, getPendingMigrations, migrationStatus } from './migrations/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tests supply an isolated runtime directory through environment variables so
// they can never mutate a developer or production SQLite database.
const configuredDbPath = process.env.DUBBING_DB_PATH;
export const dbPath = configuredDbPath
  ? path.resolve(configuredDbPath)
  : path.join(__dirname, '..', 'database', 'dubbing.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Ensure uploads directory exists
export const uploadsDir = process.env.DUBBING_UPLOADS_DIR
  ? path.resolve(process.env.DUBBING_UPLOADS_DIR)
  : path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const databaseExistedAtStartup = fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0;
export const db = new Database(dbPath);

// Enable WAL mode and foreign-key enforcement for concurrency and referential
// integrity. SQLite leaves foreign keys off unless each connection enables it.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

const migrationBackupDir = path.join(dbDir, 'backups');

function pruneBackups() {
  const keepCount = Math.max(1, Number.parseInt(process.env.DB_BACKUP_KEEP_COUNT || '14', 10) || 14);
  const backups = fs.readdirSync(migrationBackupDir)
    .filter((name) => name.startsWith('pre-migration-') && name.endsWith('.db'))
    .map((name) => ({
      path: path.join(migrationBackupDir, name),
      mtime: fs.statSync(path.join(migrationBackupDir, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const backup of backups.slice(keepCount)) fs.unlinkSync(backup.path);
}

function createMigrationBackup() {
  fs.mkdirSync(migrationBackupDir, { recursive: true, mode: 0o700 });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(migrationBackupDir, `pre-migration-${timestamp}.db`);
  db.prepare('VACUUM INTO ?').run(target);
  pruneBackups();
  return target;
}

export function getDatabaseMigrationStatus() {
  return migrationStatus(db);
}

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
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const pendingMigrations = getPendingMigrations(db);
  let migrationBackupPath = null;
  if (pendingMigrations.length > 0 && databaseExistedAtStartup && process.env.NODE_ENV !== 'test') {
    migrationBackupPath = createMigrationBackup();
  }

  // Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT,
      auth_version INTEGER NOT NULL DEFAULT 0,
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_password_reset_user
      ON password_reset_tokens (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_password_reset_expiry
      ON password_reset_tokens (expires_at);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS beta_invites (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      used_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (used_by) REFERENCES users (id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_beta_invites_email ON beta_invites (email, expires_at DESC);
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
      speaker_voices_json TEXT,
      source_media_id TEXT,
      output_media_id TEXT,
      output_audio_media_id TEXT,
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

    // Transcription Jobs Table (Persistent ASR pipeline tracking)
    db.exec(`
      CREATE TABLE IF NOT EXISTS transcription_jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT,
        media_id TEXT,
        status TEXT DEFAULT 'queued',
        progress INTEGER NOT NULL DEFAULT 10,
        current_stage TEXT,
        language TEXT DEFAULT 'en',
        provider_type TEXT DEFAULT 'auto',
        duration REAL DEFAULT 0,
        error TEXT,
        attempt INTEGER NOT NULL DEFAULT 1,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        lease_owner TEXT,
        lease_expires_at INTEGER,
        last_heartbeat_at INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL,
        FOREIGN KEY (media_id) REFERENCES media_assets (id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_transcription_jobs_user_id ON transcription_jobs (user_id);
      CREATE INDEX IF NOT EXISTS idx_transcription_jobs_project_id ON transcription_jobs (project_id);
      CREATE INDEX IF NOT EXISTS idx_transcription_jobs_status ON transcription_jobs (status);
    `);

    // Dubbing jobs persist progress and failures so users can safely retry a
    // failed pipeline after a server restart.
    db.exec(`
      CREATE TABLE IF NOT EXISTS dubbing_jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT,
        media_id TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        progress INTEGER NOT NULL DEFAULT 0,
        current_stage TEXT,
        error TEXT,
        attempt INTEGER NOT NULL DEFAULT 1,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        params_json TEXT NOT NULL DEFAULT '{}',
        result_json TEXT,
        lease_owner TEXT,
        lease_expires_at INTEGER,
        last_heartbeat_at INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL,
        FOREIGN KEY (media_id) REFERENCES media_assets (id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_dubbing_jobs_user_updated
        ON dubbing_jobs (user_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_dubbing_jobs_project_id
        ON dubbing_jobs (project_id);
    `);

    // One idempotent balance reservation per dubbing job. Minutes are held
    // when work starts, consumed on success, and returned on terminal failure.
    db.exec(`
      CREATE TABLE IF NOT EXISTS minute_usage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT,
        job_id TEXT UNIQUE NOT NULL,
        minutes REAL NOT NULL CHECK (minutes > 0),
        status TEXT NOT NULL DEFAULT 'reserved'
          CHECK (status IN ('reserved', 'consumed', 'refunded')),
        balance_after_reservation REAL,
        failure_reason TEXT,
        reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        consumed_at DATETIME,
        refunded_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL,
        FOREIGN KEY (job_id) REFERENCES dubbing_jobs (id) ON DELETE CASCADE
      );

    `);

    // Transcript Segments Table (Fine-grained timestamped dialogue)
    db.exec(`
      CREATE TABLE IF NOT EXISTS transcript_segments (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        project_id TEXT,
        start_time REAL NOT NULL,
        end_time REAL NOT NULL,
        text TEXT NOT NULL,
        speaker TEXT,
        confidence REAL DEFAULT 0.95,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES transcription_jobs (id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_transcript_segments_job_id ON transcript_segments (job_id);
      CREATE INDEX IF NOT EXISTS idx_transcript_segments_project_id ON transcript_segments (project_id);
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

    // The entitlement ledger makes gateway payment retries and refunds
    // idempotent, rather than inferring credits from the mutable user balance.
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_credits (
        order_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        minutes REAL NOT NULL,
        previous_plan TEXT NOT NULL,
        previous_subscription_expires_at DATETIME,
        applied_plan TEXT NOT NULL,
        applied_subscription_expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reversed_at DATETIME,
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_payment_credits_user_active
        ON payment_credits (user_id, reversed_at);
    `);

  const appliedMigrations = applyMigrations(db, pendingMigrations);
  if (appliedMigrations.length > 0) {
    console.log(`🗃️ Applied database migrations: ${appliedMigrations.join(', ')}`);
    if (migrationBackupPath) console.log(`🛟 Pre-migration backup: ${migrationBackupPath}`);
  }

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
