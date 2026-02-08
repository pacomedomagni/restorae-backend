#!/bin/bash
# =============================================================================
# Database Restore Script
#
# Restores a PostgreSQL backup from a compressed file.
# Usage: ./scripts/restore.sh <backup_file>
# =============================================================================

set -euo pipefail

BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./scripts/restore.sh <backup_file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lh ./backups/restorae_*.sql.gz 2>/dev/null || echo "  No backups found in ./backups/"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: File not found: $BACKUP_FILE"
  exit 1
fi

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

echo "WARNING: This will overwrite the current database!"
echo "  Backup: $BACKUP_FILE"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo "Restoring database..."
gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL" --quiet

echo "Restore complete."
echo "Run 'npx prisma migrate deploy' to ensure schema is up to date."
