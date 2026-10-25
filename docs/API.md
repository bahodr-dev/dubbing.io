# dubla.uz API

Base path: `/api`. Protected routes require the HTTP-only session cookie or an `Authorization: Bearer <token>` header.

## Error format

JSON API errors use one shape:

```json
{ "error": "Invalid project data.", "code": "BAD_REQUEST", "details": [], "requestId": "..." }
```

`requestId` can be used to find the matching server log entry.

## Main endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/auth/signup` | Create an account |
| POST | `/auth/signin` | Start a session |
| POST | `/auth/forgot-password` | Request a 30-minute password reset link |
| POST | `/auth/reset-password` | Consume a reset token and set a new password |
| GET | `/auth/me` | Current user |
| GET | `/projects?page=1&limit=24&search=&status=all` | Paginated project list |
| POST | `/projects` | Create project |
| PUT | `/projects/:id` | Update project metadata |
| PUT | `/projects/:id/transcript` | Save transcript segments |
| POST | `/media/upload` | Upload validated audio/video |
| DELETE | `/media/:id` | Delete owned media |
| POST | `/dubbing/process` | Start dubbing job |
| GET | `/dubbing/jobs/:jobId` | Poll dubbing progress |
| GET | `/dubbing/projects/:projectId/jobs/latest` | Restore polling for a project after refresh |
| POST | `/dubbing/jobs/:jobId/retry` | Retry a failed dubbing job (up to 3 attempts) |
| GET | `/dubbing/usage` | Current minute balance and recent usage history |
| POST | `/dubbing/transcribe` | Start transcription job |
| GET | `/dubbing/transcribe/jobs/:jobId` | Poll transcription progress |
| GET | `/dubbing/transcribe/projects/:projectId/jobs/latest` | Restore transcription polling after refresh |
| POST | `/dubbing/transcribe/jobs/:jobId/retry` | Retry a failed transcription job |
| GET | `/health` | Service and database schema health check |

Successful dubbing jobs return private `videoUrl` and `audioUrl` media URLs.
The final MP4 is created by aligning each synthesized speech segment to its
transcript timestamps and replacing the source video's audio track.

The dubbing worker uses database-backed leases and heartbeats. Interrupted jobs
are claimed by one worker and restarted after the previous lease expires. The
lease and polling intervals can be configured with `JOB_LEASE_MS` and
`JOB_WORKER_POLL_MS`. Untracked pipeline artifacts older than
`JOB_ARTIFACT_RETENTION_HOURS` are removed automatically; registered user media
is retained.

Standalone transcription jobs use the same lease and heartbeat guarantees.
Their provider, progress, stage, duration, and retry attempt are persisted, so
an interrupted transcription can be recovered without relying on process memory.

## Minute balance

The backend probes the uploaded media duration before a dubbing job is created.
It reserves the exact usage rounded up to the next second, consumes that
reservation once on success, and refunds it once on terminal failure. Each job
has one idempotent `minute_usage` record, so restarts and retries cannot deduct
or refund the same reservation twice.

## Password reset

Reset tokens are random 256-bit values. Only their SHA-256 hashes are stored,
they expire after 30 minutes, and they can be used once. A successful reset
invalidates existing login sessions. In development without `RESEND_API_KEY`,
the reset link is written to the server log; production requires an email key.

## Project list example

```http
GET /api/projects?page=1&limit=24&search=interview&status=draft
```

```json
{
  "projects": [],
  "pagination": { "page": 1, "limit": 24, "total": 0, "totalPages": 0, "hasNextPage": false, "hasPreviousPage": false }
}
```

## Operations

Create a SQLite backup with `npm run backup:db`. Backups are stored in `database/backups`; the default retention is 14 files and can be changed with `DB_BACKUP_KEEP_COUNT`.

Apply pending schema migrations explicitly with `npm run migrate:db`. Normal
backend startup runs the same migration flow automatically. Each applied ID is
recorded in `schema_migrations`, and an existing database is snapshotted as
`database/backups/pre-migration-*.db` before any pending migration is applied.
All pending steps use one transaction; any failure rolls back the migration and
prevents the backend from starting on a partially migrated schema.

`GET /api/health` reports `database.schemaVersion`,
`database.latestSchemaVersion`, and `database.pendingMigrations` so deployments
can verify that the running database matches the application version.
