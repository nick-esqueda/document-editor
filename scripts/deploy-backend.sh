#!/usr/bin/env bash
# Ships the committed code at HEAD to the EC2 instance and restarts the API on it.
# Usage: scripts/deploy-backend.sh   (needs the AWS CLI, signed in to the production account)
#
# Steps: git archive HEAD -> S3 -> SSM Run Command on the instance, which downloads the bundle and
# runs deploy/instance/activate-release.sh. The instance never needs access to GitHub.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/load-deploy-config.sh"
require_settings OPS_BUCKET INSTANCE_ID

RELEASE_PREFIX="releases"
COMMAND_TIMEOUT_SECONDS=900
INSTANCE_DEPLOY_LOCK="/opt/ajaia/deploy.lock"
COMMAND_POLL_SECONDS=5
# A little longer than SSM's own timeout, so SSM normally reports TimedOut first.
WAIT_DEADLINE_SECONDS=$(( COMMAND_TIMEOUT_SECONDS + 60 ))
FINISHED_STATUSES=" Success Failed Cancelled TimedOut "

# production.env is skipped: it only holds AWS resource IDs, which the instance doesn't use,
# and it is still being filled in during the first-time setup.
require_clean_tree() {
  local changes
  changes="$(git -C "${REPO_ROOT}" status --porcelain -- . ":!deploy/aws/production.env")"
  if [[ -n "${changes}" ]]; then
    echo "You have uncommitted changes. Commit them first: only committed code is deployed." >&2
    exit 1
  fi
}

upload_bundle() {
  local release_id="$1"
  git -C "${REPO_ROOT}" archive --format=tar.gz HEAD \
    | aws s3 cp - "s3://${OPS_BUCKET}/${RELEASE_PREFIX}/${release_id}.tar.gz"
}

# Builds the shell commands the instance runs, as a JSON list for SSM.
# The first deploy can start while first-boot setup (Docker install) is still running, so it waits for that.
# A lock file stops two overlapping deploys from switching the live release under each other.
build_instance_commands() {
  local release_id="$1"
  local release_dir="/opt/ajaia/releases/${release_id}"
  local bundle_url="s3://${OPS_BUCKET}/${RELEASE_PREFIX}/${release_id}.tar.gz"

  jq -n --arg dir "${release_dir}" --arg url "${bundle_url}" --arg id "${release_id}" \
    --arg region "${AWS_REGION}" --arg lock "${INSTANCE_DEPLOY_LOCK}" '{commands: [
    "set -euo pipefail",
    "export AWS_DEFAULT_REGION=\($region)",
    "cloud-init status --wait > /dev/null",
    "exec 9> \($lock)",
    "flock -n 9 || { echo \"Another deploy is already running on the instance\" >&2; exit 1; }",
    "mkdir -p \($dir)",
    "aws s3 cp \($url) - | tar -xz -C \($dir)",
    "bash \($dir)/deploy/instance/activate-release.sh \($id)"
  ]}'
}

send_release_command() {
  local release_id="$1"
  aws ssm send-command \
    --instance-ids "${INSTANCE_ID}" \
    --document-name "AWS-RunShellScript" \
    --comment "Deploy ${release_id}" \
    --timeout-seconds "${COMMAND_TIMEOUT_SECONDS}" \
    --parameters "$(build_instance_commands "${release_id}")" \
    --query "Command.CommandId" --output text
}

read_command_field() {
  local command_id="$1" field="$2"
  aws ssm get-command-invocation --command-id "${command_id}" --instance-id "${INSTANCE_ID}" \
    --query "${field}" --output text
}

# Right after send-command, SSM can briefly answer InvocationDoesNotExist. That counts as
# still pending; any other AWS error (expired credentials, access denied) stops the script.
read_command_status() {
  local command_id="$1" output
  if output="$(read_command_field "${command_id}" "Status" 2>&1)"; then
    echo "${output}"
  elif [[ "${output}" == *"InvocationDoesNotExist"* ]]; then
    echo "Pending"
  else
    echo "Could not read the deploy status: ${output}" >&2
    return 1
  fi
}

# Waits for the command to finish, prints its output, and fails unless it succeeded.
wait_for_command() {
  local command_id="$1" status="Pending" waited_seconds=0
  until [[ "${FINISHED_STATUSES}" == *" ${status} "* ]]; do
    if (( waited_seconds >= WAIT_DEADLINE_SECONDS )); then
      echo "Gave up waiting after ${WAIT_DEADLINE_SECONDS}s. Check command ${command_id} in the SSM console." >&2
      return 1
    fi
    sleep "${COMMAND_POLL_SECONDS}"
    waited_seconds=$(( waited_seconds + COMMAND_POLL_SECONDS ))
    status="$(read_command_status "${command_id}")" || return 1
  done

  read_command_field "${command_id}" "StandardOutputContent"
  read_command_field "${command_id}" "StandardErrorContent" >&2
  echo "Deploy status: ${status}"
  [[ "${status}" == "Success" ]]
}

deploy_backend() {
  require_clean_tree
  local release_id
  release_id="$(git -C "${REPO_ROOT}" rev-parse --short HEAD)-$(date -u +%Y%m%d%H%M%S)"

  upload_bundle "${release_id}"
  local command_id
  command_id="$(send_release_command "${release_id}")"
  echo "Sent deploy command ${command_id} for release ${release_id}"
  wait_for_command "${command_id}"
}

deploy_backend
