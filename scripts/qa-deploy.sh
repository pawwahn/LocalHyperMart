#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${HLM_QA_ENV_FILE:-.env.qa}"
COMPOSE_FILES="-f docker-compose.qa.yml"
[[ -f docker-compose.hostinger.yml ]] && COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.hostinger.yml"
[[ -f "$ENV_FILE" ]] || { echo "Create $ENV_FILE from .env.qa.example" >&2; exit 1; }
BUILD=()
[[ "${1:-}" == "--build" ]] && BUILD=(--build)
docker compose $COMPOSE_FILES --env-file "$ENV_FILE" up -d "${BUILD[@]}"
docker compose $COMPOSE_FILES --env-file "$ENV_FILE" ps
