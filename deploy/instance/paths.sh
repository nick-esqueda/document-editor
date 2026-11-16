#!/usr/bin/env bash
# Shared locations on the EC2 instance. Sourced by the other scripts in this folder.
# shellcheck disable=SC2034 # the variables are used by the scripts that source this file

APP_ROOT="/opt/ajaia"
RELEASES_DIR="${APP_ROOT}/releases"
CURRENT_RELEASE_LINK="${APP_ROOT}/current"
ENV_FILE="${APP_ROOT}/.env"
COMPOSE_FILE_NAME="docker-compose.prod.yml"

# Parameter Store path that holds every production setting (secrets as SecureString).
PARAMETER_PATH="/ajaia/prod/"

IMDS_URL="http://169.254.169.254/latest"
IMDS_TOKEN_TTL_SECONDS=60

# The AWS CLI on the instance needs a region. Read it from the instance metadata service (IMDSv2).
detect_instance_region() {
  local token
  token="$(curl -sf -X PUT "${IMDS_URL}/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: ${IMDS_TOKEN_TTL_SECONDS}")"
  curl -sf -H "X-aws-ec2-metadata-token: ${token}" "${IMDS_URL}/meta-data/placement/region"
}

if [[ -z "${AWS_DEFAULT_REGION:-}" ]]; then
  AWS_DEFAULT_REGION="$(detect_instance_region)"
  export AWS_DEFAULT_REGION
fi

# Runs docker compose for the active release with the production env file.
run_compose() {
  docker compose \
    --project-directory "${CURRENT_RELEASE_LINK}" \
    --env-file "${ENV_FILE}" \
    -f "${CURRENT_RELEASE_LINK}/${COMPOSE_FILE_NAME}" \
    "$@"
}
