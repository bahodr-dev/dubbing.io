function columnNames(db, tableName) {
  return new Set(db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name));
}

function addMissingColumns(db, tableName, columns) {
  const existing = columnNames(db, tableName);
  for (const column of columns) {
    if (!existing.has(column.name)) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.type}`);
    }
  }
}

export const MIGRATIONS = [
  {
    id: '001_user_security_and_balance',
    up(db) {
      addMissingColumns(db, 'users', [
        { name: 'updated_at', type: 'DATETIME' },
        { name: 'auth_version', type: 'INTEGER NOT NULL DEFAULT 0' },
        { name: 'plan', type: "TEXT DEFAULT 'free'" },
        { name: 'minutes_balance', type: 'REAL DEFAULT 5.0' },
        { name: 'subscription_expires_at', type: 'DATETIME' },
      ]);
      db.exec(`
        UPDATE users
        SET auth_version = COALESCE(auth_version, 0),
            plan = COALESCE(plan, 'free'),
            minutes_balance = COALESCE(minutes_balance, 5.0),
            updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
      `);
    },
  },
  {
    id: '002_project_media_outputs',
    up(db) {
      addMissingColumns(db, 'projects', [
        { name: 'description', type: 'TEXT' },
        { name: 'voice_id', type: "TEXT DEFAULT 'voice-farrux'" },
        { name: 'file_size', type: "TEXT DEFAULT '12.4 MB'" },
        { name: 'video_quality', type: "TEXT DEFAULT '1080p'" },
        { name: 'source_media_id', type: 'TEXT' },
        { name: 'output_media_id', type: 'TEXT' },
        { name: 'output_audio_media_id', type: 'TEXT' },
      ]);
    },
  },
  {
    id: '003_transcription_worker_leases',
    up(db) {
      addMissingColumns(db, 'transcription_jobs', [
        { name: 'progress', type: 'INTEGER NOT NULL DEFAULT 10' },
        { name: 'current_stage', type: 'TEXT' },
        { name: 'provider_type', type: "TEXT DEFAULT 'auto'" },
        { name: 'attempt', type: 'INTEGER NOT NULL DEFAULT 1' },
        { name: 'max_attempts', type: 'INTEGER NOT NULL DEFAULT 3' },
        { name: 'lease_owner', type: 'TEXT' },
        { name: 'lease_expires_at', type: 'INTEGER' },
        { name: 'last_heartbeat_at', type: 'INTEGER' },
      ]);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_transcription_jobs_recovery
          ON transcription_jobs (status, lease_expires_at, updated_at)
      `);
    },
  },
  {
    id: '004_dubbing_worker_leases',
    up(db) {
      addMissingColumns(db, 'dubbing_jobs', [
        { name: 'lease_owner', type: 'TEXT' },
        { name: 'lease_expires_at', type: 'INTEGER' },
        { name: 'last_heartbeat_at', type: 'INTEGER' },
      ]);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_dubbing_jobs_recovery
          ON dubbing_jobs (status, lease_expires_at, updated_at)
      `);
    },
  },
  {
    id: '005_operational_indexes_and_usage',
    up(db) {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_projects_user_updated
          ON projects (user_id, updated_at DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_projects_user_status_updated
          ON projects (user_id, status, updated_at DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_minute_usage_user_created
          ON minute_usage (user_id, reserved_at DESC);
        CREATE INDEX IF NOT EXISTS idx_minute_usage_status
          ON minute_usage (status, updated_at);
      `);
    },
  },
  {
    id: '006_payment_credit_ledger',
    up(db) {
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
    },
  },
  {
    id: '007_project_speaker_voices',
    up(db) {
      addMissingColumns(db, 'projects', [
        { name: 'speaker_voices_json', type: 'TEXT' },
      ]);
    },
  },
  {
    id: '008_transcript_speaker_source',
    up(db) {
      addMissingColumns(db, 'transcript_segments', [
        { name: 'speaker_source', type: 'TEXT' },
      ]);
    },
  },
  {
    id: '009_job_voice_clones',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS job_voice_clones (
          id TEXT PRIMARY KEY,
          job_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          speaker TEXT NOT NULL,
          provider_voice_id TEXT NOT NULL UNIQUE,
          consent_at TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          deleted_at DATETIME,
          FOREIGN KEY (job_id) REFERENCES dubbing_jobs (id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
          UNIQUE (job_id, speaker)
        );
        CREATE INDEX IF NOT EXISTS idx_job_voice_clones_cleanup
          ON job_voice_clones (deleted_at, created_at);
      `);
    },
  },
  {
    id: '010_closed_beta_invites',
    up(db) {
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
        CREATE INDEX IF NOT EXISTS idx_beta_invites_email
          ON beta_invites (email, expires_at DESC);
      `);
      addMissingColumns(db, 'oauth_states', [
        { name: 'invite_id', type: 'TEXT' },
      ]);
    },
  },
  {
    id: '011_click_prepare_identifiers',
    up(db) {
      addMissingColumns(db, 'click_transactions', [
        { name: 'prepare_id', type: 'INTEGER' },
      ]);
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_click_prepare_id ON click_transactions (prepare_id)');
    },
  },
];

export function getPendingMigrations(db) {
  const applied = new Set(db.prepare('SELECT id FROM schema_migrations').all().map((row) => row.id));
  return MIGRATIONS.filter((migration) => !applied.has(migration.id));
}

export function applyMigrations(db, pendingMigrations) {
  if (pendingMigrations.length === 0) return [];
  const appliedNow = [];
  const findApplied = db.prepare('SELECT 1 FROM schema_migrations WHERE id = ?');
  const insertApplied = db.prepare(`
    INSERT INTO schema_migrations (id, applied_at)
    VALUES (?, CURRENT_TIMESTAMP)
  `);
  const migrate = db.transaction(() => {
    for (const migration of pendingMigrations) {
      // Another worker may have applied a migration after the pending list was read.
      if (findApplied.get(migration.id)) continue;
      migration.up(db);
      insertApplied.run(migration.id);
      appliedNow.push(migration.id);
    }
  });
  migrate.immediate();
  return appliedNow;
}

export function migrationStatus(db) {
  const applied = db.prepare('SELECT id, applied_at FROM schema_migrations ORDER BY id').all();
  const pending = getPendingMigrations(db).map((migration) => migration.id);
  return {
    currentVersion: applied.at(-1)?.id || null,
    latestVersion: MIGRATIONS.at(-1)?.id || null,
    appliedCount: applied.length,
    pending,
  };
}
