#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_RECIPIENT:?Set BACKUP_RECIPIENT to an age public key}"
: "${BACKUP_REMOTE:?Set BACKUP_REMOTE to an rclone destination}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="$(mktemp -d)"
trap 'rm -rf -- "$WORK"' EXIT

cd /opt/dubla/current
/usr/bin/npm run backup:db
/usr/bin/tar -C /var/lib/dubla -czf "$WORK/dubla-$STAMP.tar.gz" database/backups media
/usr/bin/age -r "$BACKUP_RECIPIENT" -o "$WORK/dubla-$STAMP.tar.gz.age" "$WORK/dubla-$STAMP.tar.gz"
/usr/bin/rclone copy "$WORK/dubla-$STAMP.tar.gz.age" "$BACKUP_REMOTE"
