#!/usr/bin/env bash
# Sourced by the deploy scripts: loads deploy/aws/production.env and checks nothing is blank.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_CONFIG_FILE="${REPO_ROOT}/deploy/aws/production.env"

# Exits with a clear message if any of the named settings is empty.
require_settings() {
  local name
  for name in "$@"; do
    if [[ -z "${!name:-}" ]]; then
      echo "${name} is empty. Set it in ${DEPLOY_CONFIG_FILE}." >&2
      exit 1
    fi
  done
}

set -a
# shellcheck source=../deploy/aws/production.env
source "${DEPLOY_CONFIG_FILE}"
set +a
export AWS_DEFAULT_REGION="${AWS_REGION}"
