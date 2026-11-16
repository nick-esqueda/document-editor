#!/usr/bin/env bash
# EC2 user data: runs once, as root, the first time the instance boots (Amazon Linux 2023, ARM).
# Installs Docker with the Compose and Buildx plugins and creates the app folders.
# The app itself arrives later through scripts/deploy-backend.sh.
set -euo pipefail

COMPOSE_VERSION="v2.29.7"
BUILDX_VERSION="v0.17.1"
CLI_PLUGIN_DIR="/usr/local/lib/docker/cli-plugins"
SWAP_FILE="/swapfile"
SWAP_SIZE_MB=2048

install_docker() {
  dnf install -y docker
  systemctl enable --now docker
}

install_docker_plugins() {
  mkdir -p "${CLI_PLUGIN_DIR}"
  curl -fsSL -o "${CLI_PLUGIN_DIR}/docker-compose" \
    "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-aarch64"
  curl -fsSL -o "${CLI_PLUGIN_DIR}/docker-buildx" \
    "https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}/buildx-${BUILDX_VERSION}.linux-arm64"
  chmod +x "${CLI_PLUGIN_DIR}/docker-compose" "${CLI_PLUGIN_DIR}/docker-buildx"
}

# 2 GB of RAM is tight while npm ci and Postgres run together, so add swap as a safety net.
add_swap() {
  dd if=/dev/zero of="${SWAP_FILE}" bs=1M count="${SWAP_SIZE_MB}"
  chmod 600 "${SWAP_FILE}"
  mkswap "${SWAP_FILE}"
  swapon "${SWAP_FILE}"
  echo "${SWAP_FILE} none swap sw 0 0" >> /etc/fstab
}

install_docker
install_docker_plugins
add_swap
mkdir -p /opt/ajaia/releases
