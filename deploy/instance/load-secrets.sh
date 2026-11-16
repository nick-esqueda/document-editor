#!/usr/bin/env bash
# Writes every parameter under /ajaia/prod/ in Parameter Store to the production env file,
# as NAME='value' lines readable only by root. Secrets never touch git or the release bundle.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/paths.sh"

fetch_parameters() {
  aws ssm get-parameters-by-path \
    --path "${PARAMETER_PATH}" \
    --with-decryption \
    --query "Parameters[].[Name,Value]" \
    --output text
}

# Turns "/ajaia/prod/SESSION_SECRET<TAB>value" into "SESSION_SECRET='value'".
format_env_lines() {
  local name value
  while IFS=$'\t' read -r name value; do
    if [[ "${value}" == *"'"* ]]; then
      echo "Parameter ${name} contains a single quote, which the env file can't hold" >&2
      exit 1
    fi
    echo "${name#"${PARAMETER_PATH}"}='${value}'"
  done
}

write_env_file() {
  local temporary_file
  temporary_file="$(mktemp)"
  chmod 600 "${temporary_file}"

  fetch_parameters | format_env_lines > "${temporary_file}"
  mv "${temporary_file}" "${ENV_FILE}"
}

write_env_file
echo "Wrote $(wc -l < "${ENV_FILE}") settings to ${ENV_FILE}"
