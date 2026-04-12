#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure Docker is available (start Colima on macOS if needed)
ensure_docker() {
  # Check if docker is already running
  if docker info &> /dev/null; then
    return 0
  fi

  # Docker not running - check if we're on macOS with Colima
  if [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v colima &> /dev/null; then
      echo -e "${YELLOW}Docker not running. Starting Colima...${NC}"
      colima start

      # Wait for docker to be ready
      echo -e "${BLUE}Waiting for Docker to be ready...${NC}"
      TIMEOUT=60
      ELAPSED=0
      until docker info &> /dev/null; do
        if [ $ELAPSED -ge $TIMEOUT ]; then
          echo -e "${RED}Timeout waiting for Docker to start${NC}"
          exit 1
        fi
        echo -n "."
        sleep 2
        ELAPSED=$((ELAPSED + 2))
      done
      echo ""
      echo -e "${GREEN}Docker is ready${NC}"
    else
      echo -e "${RED}Error: Docker not running and Colima not found${NC}"
      echo -e "${YELLOW}Install Colima: brew install colima${NC}"
      exit 1
    fi
  else
    # Linux or other OS
    echo -e "${RED}Error: Docker is not running${NC}"
    echo -e "${YELLOW}Start Docker and try again${NC}"
    exit 1
  fi
}

# Ensure Docker is running (starts Colima on macOS if needed)
ensure_docker

# Load environment variables
if [ ! -f .env ]; then
  echo -e "${RED}Error: .env file not found${NC}"
  exit 1
fi

# Export variables from .env
set -a
source .env
set +a

# Validate required env variables
if [ -z "$PROD_SSH_HOST" ]; then
  echo -e "${RED}Error: PROD_SSH_HOST not set in .env${NC}"
  echo "Example: PROD_SSH_HOST=user@your-server.com"
  exit 1
fi

if [ -z "$PROD_DATABASE_URI" ]; then
  echo -e "${RED}Error: PROD_DATABASE_URI not set in .env${NC}"
  echo "Example: PROD_DATABASE_URI=postgres://user:password@host:5432/dbname"
  exit 1
fi

# Parse production DATABASE_URI
PROD_DB_USER=$(echo $PROD_DATABASE_URI | sed -n 's|postgres://\([^:]*\):.*|\1|p')
PROD_DB_PASS=$(echo $PROD_DATABASE_URI | sed -n 's|postgres://[^:]*:\([^@]*\)@.*|\1|p')
PROD_DB_HOST=$(echo $PROD_DATABASE_URI | sed -n 's|.*@\([^:]*\):.*|\1|p')
PROD_DB_NAME=$(echo $PROD_DATABASE_URI | sed -n 's|.*/\([^?]*\).*|\1|p')

# In Coolify, the host is the container name
PROD_POSTGRES_CONTAINER=$PROD_DB_HOST

# Parse local DATABASE_URI
LOCAL_DB_USER=$(echo $DATABASE_URI | sed -n 's|postgres://\([^:]*\):.*|\1|p')
LOCAL_DB_NAME=$(echo $DATABASE_URI | sed -n 's|.*/\([^?]*\).*|\1|p')

# Local Docker container name - auto-detect from running/stopped containers
# Try docker-compose first, then fallback to finding any local postgres container
if command -v docker-compose &> /dev/null; then
  LOCAL_POSTGRES_CONTAINER=$(docker-compose ps -a -q postgres 2>/dev/null | xargs docker inspect --format='{{.Name}}' 2>/dev/null | sed 's|^/||' | head -1)
fi

# Fallback: find postgres container by name pattern
if [ -z "$LOCAL_POSTGRES_CONTAINER" ]; then
  LOCAL_POSTGRES_CONTAINER=$(docker ps -a --format '{{.Names}}' | grep -E 'postgres|cms.*postgres' | head -1)
fi

# Last resort fallback
if [ -z "$LOCAL_POSTGRES_CONTAINER" ]; then
  LOCAL_POSTGRES_CONTAINER="cms-postgres-1"
fi

DUMP_FILE="prod-dump-$(date +%Y%m%d-%H%M%S).sql"
REMOTE_DUMP_PATH="/tmp/$DUMP_FILE"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Clone Production Database to Local                ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo ""
echo -e "${YELLOW}Production:${NC}"
echo -e "  SSH Host: $PROD_SSH_HOST"
echo -e "  Container: $PROD_POSTGRES_CONTAINER"
echo -e "  Database: $PROD_DB_NAME"
echo -e "  User: $PROD_DB_USER"
echo ""
echo -e "${YELLOW}Local:${NC}"
echo -e "  Container: $LOCAL_POSTGRES_CONTAINER"
echo -e "  Database: $LOCAL_DB_NAME"
echo -e "  User: $LOCAL_DB_USER"
echo ""

read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}Aborted${NC}"
  exit 0
fi

# Step 1: Dump production database
echo ""
echo -e "${GREEN}[1/6] Dumping production database...${NC}"
ssh $PROD_SSH_HOST "docker exec -e PGPASSWORD='$PROD_DB_PASS' $PROD_POSTGRES_CONTAINER pg_dump -U $PROD_DB_USER -d $PROD_DB_NAME --clean --if-exists > $REMOTE_DUMP_PATH"

# Step 2: Download dump
echo -e "${GREEN}[2/6] Downloading dump to local...${NC}"
scp $PROD_SSH_HOST:$REMOTE_DUMP_PATH /tmp/$DUMP_FILE

# Step 3: Cleanup remote dump
echo -e "${GREEN}[3/6] Cleaning up remote dump...${NC}"
ssh $PROD_SSH_HOST "rm $REMOTE_DUMP_PATH"

# Step 4: Stop local dev server if running
echo -e "${GREEN}[4/6] Stopping local services...${NC}"
if docker ps | grep -q $LOCAL_POSTGRES_CONTAINER; then
  docker-compose down
fi

# Step 5: Start fresh local database
echo -e "${GREEN}[5/6] Starting fresh local database...${NC}"
docker-compose down -v  # Remove volumes to start clean
docker-compose up -d
sleep 3  # Wait for postgres to be ready

# Wait for postgres to accept connections
echo -e "${BLUE}Waiting for local postgres to be ready...${NC}"
TIMEOUT=30
ELAPSED=0
until docker exec $LOCAL_POSTGRES_CONTAINER pg_isready -U $LOCAL_DB_USER > /dev/null 2>&1; do
  if [ $ELAPSED -ge $TIMEOUT ]; then
    echo ""
    echo -e "${RED}Timeout waiting for postgres. Check logs with: docker logs $LOCAL_POSTGRES_CONTAINER${NC}"
    exit 1
  fi
  echo -n "."
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done
echo ""

# Step 6: Restore dump to local
echo -e "${GREEN}[6/6] Restoring production data to local database...${NC}"
if cat /tmp/$DUMP_FILE | docker exec -i $LOCAL_POSTGRES_CONTAINER psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -q > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Restore completed successfully${NC}"
else
  echo -e "${RED}✗ Restore failed. Showing errors:${NC}"
  cat /tmp/$DUMP_FILE | docker exec -i $LOCAL_POSTGRES_CONTAINER psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME
  exit 1
fi

# Cleanup local dump
rm /tmp/$DUMP_FILE

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Production database cloned successfully!               ║${NC}"
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo ""
echo -e "${RED}⚠️  WARNING: This database is for MIGRATION TESTING ONLY${NC}"
echo ""
echo -e "${YELLOW}The cloned data contains URLs pointing to production R2 storage.${NC}"
echo -e "${YELLOW}Your local .env has different R2 settings (bucket/prefix).${NC}"
echo ""
echo -e "${RED}DO NOT use this database for regular development:${NC}"
echo -e "  • Don't upload new media (goes to wrong bucket)"
echo -e "  • Don't delete media (tries to delete from wrong bucket)"
echo ""
echo -e "${YELLOW}You might edit the rest of the content easily.${NC}"
echo ""
echo -e "${RED}You should re-generate a new api-key and write it in the .ENV of the frontend.${NC}"
echo ""
echo -e "${YELLOW}Next steps to test migrations:${NC}"
echo ""
echo -e "  1. Check migration status:"
echo -e "     ${BLUE}pnpm run migrate:status${NC}"
echo ""
echo -e "  2. Run pending migrations:"
echo -e "     ${BLUE}pnpm run migrate${NC}"
echo ""
echo -e "  3. Verify migrations worked (optional):"
echo -e "     ${BLUE}docker exec cms-postgres-1 psql -U postgres -d martyrio-cms -c \"\\d media\"${NC}"
echo ""
echo -e "  4. Stop the test database:"
echo -e "     ${BLUE}docker-compose down${NC}"
echo ""
echo -e "${GREEN}After migration testing, restore clean local environment:${NC}"
echo -e "  ${BLUE}docker-compose down -v${NC}  # Wipe cloned production data"
echo -e "  ${BLUE}pnpm run dev${NC}            # Start fresh with local data"
echo ""
