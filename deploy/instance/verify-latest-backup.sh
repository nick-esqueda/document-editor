#!/usr/bin/env bash
# Restores the newest S3 backup into a throwaway Postgres container and compares row counts
# with the live database. Prints both and exits non-zero if they differ.
# Counts can legitimately differ if someone edited the app since the backup was taken,
# so run it right after backup-database.sh for a clean comparison.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/paths.sh"
# shellcheck disable=SC1090 # generated at deploy time by load-secrets.sh
source "${ENV_FILE}"

BACKUP_PREFIX="backups"
SCRATCH_CONTAINER="ajaia-restore-check"
SCRATCH_PASSWORD="restore-check"
SCRATCH_READY_TIMEOUT_SECONDS=60
TABLES=("users" "documents" "document_access")

find_latest_backup_key() {
  aws s3api list-objects-v2 \
    --bucket "${OPS_BUCKET}" \
    --prefix "${BACKUP_PREFIX}/" \
    --query "sort_by(Contents, &LastModified)[-1].Key" \
    --output text
}

start_scratch_database() {
  docker run -d --rm --name "${SCRATCH_CONTAINER}" \
    -e POSTGRES_PASSWORD="${SCRATCH_PASSWORD}" postgres:16-alpine > /dev/null

  local waited_seconds=0
  until docker exec "${SCRATCH_CONTAINER}" pg_isready -U postgres > /dev/null 2>&1; do
    (( waited_seconds++ < SCRATCH_READY_TIMEOUT_SECONDS )) || { echo "Scratch Postgres never became ready" >&2; exit 1; }
    sleep 1
  done
}

stop_scratch_database() {
  docker rm -f "${SCRATCH_CONTAINER}" > /dev/null 2>&1 || true
}

restore_backup() {
  local backup_key="$1"
  aws s3 cp "s3://${OPS_BUCKET}/${backup_key}" - \
    | docker exec -i "${SCRATCH_CONTAINER}" pg_restore --no-owner --username postgres --dbname postgres
}

count_rows_in_live() {
  run_compose exec -T postgres \
    psql --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" -tAc "SELECT count(*) FROM $1"
}

count_rows_in_scratch() {
  docker exec "${SCRATCH_CONTAINER}" psql --username postgres -tAc "SELECT count(*) FROM $1"
}

compare_row_counts() {
  local table live_count restored_count has_mismatch=false
  for table in "${TABLES[@]}"; do
    live_count="$(count_rows_in_live "${table}")"
    restored_count="$(count_rows_in_scratch "${table}")"
    echo "${table}: live=${live_count} restored=${restored_count}"
    [[ "${live_count}" == "${restored_count}" ]] || has_mismatch=true
  done
  [[ "${has_mismatch}" == false ]]
}

verify_latest_backup() {
  local backup_key
  backup_key="$(find_latest_backup_key)"
  echo "Checking ${backup_key}"

  trap stop_scratch_database EXIT
  start_scratch_database
  restore_backup "${backup_key}"
  compare_row_counts
}

verify_latest_backup
