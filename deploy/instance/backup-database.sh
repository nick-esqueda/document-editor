#!/usr/bin/env bash
# Dumps the production database to S3 (custom pg_dump format). Run nightly by ajaia-backup.timer.
# The S3 bucket's lifecycle rule deletes backups after 14 days.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/paths.sh"
# shellcheck disable=SC1090 # generated at deploy time by load-secrets.sh
source "${ENV_FILE}"

BACKUP_PREFIX="backups"

dump_database() {
  run_compose exec -T postgres \
    pg_dump --format=custom --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}"
}

backup_database() {
  local timestamp backup_url
  timestamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
  backup_url="s3://${OPS_BUCKET}/${BACKUP_PREFIX}/${timestamp}.dump"

  dump_database | aws s3 cp - "${backup_url}"
  echo "Backed up to ${backup_url}"
}

backup_database
