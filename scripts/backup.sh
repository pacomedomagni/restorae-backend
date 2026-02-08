#!/bin/bash
# =============================================================================
# Database Backup Script
#
# Creates a compressed PostgreSQL backup with timestamp.
# Usage: ./scripts/backup.sh [output_dir]
# =============================================================================

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/restorae_${TIMESTAMP}.sql.gz"

# Read DATABASE_URL from .env or environment
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f .env ]; then
    export $(grep -E '^DATABASE_URL=' .env | xargs)
  elif [ -f .env.prod ]; then
    export $(grep -E '^DATABASE_URL=' .env.prod | xargs)
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set. Provide via env or .env file."
  exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Starting backup..."
echo "  Output: $BACKUP_FILE"

# Run pg_dump and compress
pg_dump "$DATABASE_URL" --no-owner --no-privileges --clean --if-exists | gzip > "$BACKUP_FILE"

# Verify file was created and has content
if [ -s "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "Backup complete: $BACKUP_FILE ($SIZE)"

  # Clean up old backups (keep last 30)
  ls -t "$BACKUP_DIR"/restorae_*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm --
  echo "Old backups cleaned (keeping last 30)"
else
  echo "ERROR: Backup file is empty"
  rm -f "$BACKUP_FILE"
  exit 1
fi
