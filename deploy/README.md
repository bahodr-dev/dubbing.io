# Production runbook

Create the `dubla` system user and `/var/lib/dubla/{database,media}`, install Node 20+, FFmpeg, Nginx, age and rclone, then copy the app to `/opt/dubla/current`. Put secrets in `/etc/dubla/dubla.env` with mode `0600`; never commit it.

Run `npm ci && npm run readiness` before upload. On the VPS run `npm run build && npm run migrate:db && npm run preflight`, install the Nginx and systemd templates, then enable `dubla.service` and `dubla-backup.timer`. Configure an external monitor for `https://dubla.uz/api/health` and a disk check at 70% warning / 85% critical.

Before inviting users, run a Payme and Click purchase through the real callback flow, `npm run beta -- status`, and a restore drill on a separate directory. Decrypt an off-site archive with `age -d`, restore both `database` and `media`, start the service against the restored paths, and verify `/api/health`, one old project, and one download.
