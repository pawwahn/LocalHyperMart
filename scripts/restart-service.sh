#!/usr/bin/env bash
# Git Bash / WSL — restart any local dev service (see restart-service.ps1).
#
#   ./scripts/restart-service.sh list
#   ./scripts/restart-service.sh order-service
#   ./scripts/restart-service.sh vendor-portal
#   ./scripts/restart-service.sh all-java
#   ./scripts/restart-service.sh all
#   ./scripts/restart-service.sh order-service -- -SkipBuild
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-order-service}"
shift || true
exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ROOT/scripts/restart-service.ps1" "$TARGET" "$@"
