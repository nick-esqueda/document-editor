#!/usr/bin/env bash
# Builds the React app and publishes it to the S3 bucket behind CloudFront.
# Usage: scripts/deploy-frontend.sh   (needs the AWS CLI, signed in to the production account)
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/load-deploy-config.sh"
require_settings FRONTEND_BUCKET DISTRIBUTION_ID

BUILD_DIR="${REPO_ROOT}/client/dist"
# Files under assets/ have a content hash in their name, so they can be cached for a year.
HASHED_ASSET_CACHE="public, max-age=31536000, immutable"
OTHER_FILE_CACHE="public, max-age=3600"
# index.html must always be fetched fresh so users get the newest asset names.
ENTRY_PAGE_CACHE="no-cache"

build_client() {
  (cd "${REPO_ROOT}" && npm run build -w client)
}

# Old hashed assets are kept (no --delete), so a browser still holding the previous
# index.html can load the files it points to.
upload_build() {
  local bucket_url="s3://${FRONTEND_BUCKET}"

  aws s3 sync "${BUILD_DIR}/assets" "${bucket_url}/assets" --cache-control "${HASHED_ASSET_CACHE}"
  aws s3 sync "${BUILD_DIR}" "${bucket_url}" \
    --exclude "assets/*" --exclude "index.html" --cache-control "${OTHER_FILE_CACHE}"
  aws s3 cp "${BUILD_DIR}/index.html" "${bucket_url}/index.html" --cache-control "${ENTRY_PAGE_CACHE}"
}

invalidate_entry_page() {
  aws cloudfront create-invalidation \
    --distribution-id "${DISTRIBUTION_ID}" \
    --paths "/index.html" \
    --query "Invalidation.Id" --output text
}

build_client
upload_build
invalidate_entry_page
echo "Frontend deployed to https://${APP_DOMAIN}"
