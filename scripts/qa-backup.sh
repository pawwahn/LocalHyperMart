#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${HLM_QA_ENV_FILE:-.env.qa}"
COMPOSE_FILES="-f docker-compose.qa.yml"
[[ -f docker-compose.hostinger.yml ]] && COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.hostinger.yml"
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }
set -a; source "$ENV_FILE"; set +a
BACKUP_DIR="${HLM_QA_BACKUP_DIR:-$ROOT/backups/qa}"
mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/pg-all-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose $COMPOSE_FILES --env-file "$ENV_FILE" exec -T postgres pg_dumpall -U "${POSTGRES_USER}" | gzip -9 > "$OUT"
find "$BACKUP_DIR" -name 'pg-all-*.sql.gz' -mtime +14 -delete 2>/dev/null || true
echo "Backup: $OUT"
