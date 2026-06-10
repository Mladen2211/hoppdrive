#!/usr/bin/env bash
# Database backup script — run daily via cron or Docker entrypoint
# Keeps the last 7 days of backups in /backups
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-7}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="hoppdrive_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting PostgreSQL dump at $(date)"

# Dump and compress in one step
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/$FILENAME"

echo "[backup] Saved: $BACKUP_DIR/$FILENAME ($(du -sh "$BACKUP_DIR/$FILENAME" | cut -f1))"

# Prune backups older than RETAIN_DAYS
find "$BACKUP_DIR" -name "hoppdrive_*.sql.gz" -mtime +"$RETAIN_DAYS" -delete
echo "[backup] Pruned backups older than ${RETAIN_DAYS} days"

echo "[backup] Done at $(date)"
