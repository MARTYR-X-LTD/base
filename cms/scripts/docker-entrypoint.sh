#!/bin/sh
set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          PayloadCMS Production Startup                    ║"
echo "╔════════════════════════════════════════════════════════════╗"
echo ""

# Parse DATABASE_URI to get connection details
if [ -z "$DATABASE_URI" ]; then
  echo "ERROR: DATABASE_URI not set"
  exit 1
fi

DB_USER=$(echo $DATABASE_URI | sed -n 's|postgres://\([^:]*\):.*|\1|p')
DB_PASS=$(echo $DATABASE_URI | sed -n 's|postgres://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo $DATABASE_URI | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo $DATABASE_URI | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo $DATABASE_URI | sed -n 's|.*/\([^?]*\).*|\1|p')

# Directory for backups (mounted volume in production)
BACKUP_DIR="/app/db-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/pre-startup-$TIMESTAMP.sql"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo "[1/3] Waiting for database to be ready..."
export PGPASSWORD=$DB_PASS
until pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME > /dev/null 2>&1; do
  echo "  Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."
  sleep 2
done
echo "✓ Database is ready"
echo ""

echo "[2/3] Creating pre-startup backup..."
if pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --clean --if-exists > $BACKUP_FILE 2>/dev/null; then
  BACKUP_SIZE=$(du -h $BACKUP_FILE | cut -f1)
  echo "✓ Backup created: pre-startup-$TIMESTAMP.sql ($BACKUP_SIZE)"

  # Clean up old backups (keep last 5)
  ls -t $BACKUP_DIR/pre-startup-*.sql 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
  BACKUP_COUNT=$(ls -1 $BACKUP_DIR/pre-startup-*.sql 2>/dev/null | wc -l)
  echo "  Keeping last $BACKUP_COUNT startup backups"
else
  echo "⚠ Backup failed - continuing anyway (not critical)"
fi
echo ""

echo "[3/3] Starting application server..."
echo "  PayloadCMS will run migrations automatically during initialization"
echo "  If migrations fail, check backup at: $BACKUP_FILE"
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✓ Pre-startup complete - launching server...             ║"
echo "╔════════════════════════════════════════════════════════════╗"
echo ""

# Start the Next.js server
# PayloadCMS will automatically run prodMigrations during initialization
# Set HOSTNAME to 0.0.0.0 so server listens on all interfaces
exec env HOSTNAME=0.0.0.0 node server.js
