#!/bin/sh

set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
MONOREPO_DIR=$(CDPATH= cd -- "$PROJECT_DIR/../.." && pwd)
CONTAINER_BIN=${CONTAINER_BIN:-container}
IMAGE_NAME=${NIMA_CONTAINER_IMAGE:-nima-tech-space:local}
CONTAINER_NAME=${NIMA_CONTAINER_NAME:-nima-tech-space}
HOST_PORT=${NIMA_CONTAINER_PORT:-4321}
BIND_ADDRESS=${NIMA_CONTAINER_BIND:-127.0.0.1}
CPUS=${NIMA_CONTAINER_CPUS:-2}
MEMORY=${NIMA_CONTAINER_MEMORY:-2g}
BUILD_CPUS=${NIMA_CONTAINER_BUILD_CPUS:-4}
BUILD_MEMORY=${NIMA_CONTAINER_BUILD_MEMORY:-4g}
DNS_SERVER=${NIMA_CONTAINER_DNS:-223.5.5.5}
RUNTIME_DIR="$PROJECT_DIR/runtime"
BASE_ENV_FILE="$PROJECT_DIR/.env"
CONTAINER_ENV_FILE="$PROJECT_DIR/.env.container"

usage() {
  cat <<'EOF'
Usage: ./scripts/apple-container.sh <command>

Commands:
  build     Build the nima-tech-space image
  start     Start the website container
  restart   Recreate and start the website container
  stop      Stop the website container
  status    Show container status and local URL
  logs      Follow website logs
EOF
}

require_container() {
  if ! command -v "$CONTAINER_BIN" >/dev/null 2>&1; then
    echo "Apple Container is not installed or is not in PATH." >&2
    exit 1
  fi
}

start_system() {
  "$CONTAINER_BIN" system start
}

container_exists() {
  "$CONTAINER_BIN" list --all --quiet 2>/dev/null | grep -Fqx "$CONTAINER_NAME"
}

remove_existing_container() {
  if container_exists; then
    "$CONTAINER_BIN" stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
    "$CONTAINER_BIN" delete "$CONTAINER_NAME" >/dev/null
  fi
}

build_image() {
  start_system
  cd "$MONOREPO_DIR"
  "$CONTAINER_BIN" builder start \
    --cpus "$BUILD_CPUS" \
    --memory "$BUILD_MEMORY" \
    --dns "$DNS_SERVER"

  build_status=0
  "$CONTAINER_BIN" build \
    --dns "$DNS_SERVER" \
    --tag "$IMAGE_NAME" \
    --file "$PROJECT_DIR/Dockerfile" \
    "$MONOREPO_DIR" || build_status=$?

  # The builder VM is only needed during image creation and reserves substantial memory.
  "$CONTAINER_BIN" builder stop >/dev/null 2>&1 || true
  return "$build_status"
}

start_container() {
  start_system
  mkdir -p "$RUNTIME_DIR/data" "$RUNTIME_DIR/hosted-apps" "$RUNTIME_DIR/downloads"
  remove_existing_container

  set -- run \
    --name "$CONTAINER_NAME" \
    --detach \
    --init \
    --cpus "$CPUS" \
    --memory "$MEMORY" \
    --dns "$DNS_SERVER" \
    --publish "${BIND_ADDRESS}:${HOST_PORT}:4321" \
    --volume "$RUNTIME_DIR:/app/runtime"

  if [ -f "$BASE_ENV_FILE" ]; then
    set -- "$@" --env-file "$BASE_ENV_FILE"
  fi

  if [ -f "$CONTAINER_ENV_FILE" ]; then
    set -- "$@" --env-file "$CONTAINER_ENV_FILE"
  fi

  # Storage must stay local even if a legacy .env file still contains Vercel/Neon values.
  set -- "$@" \
    --env "HOST=0.0.0.0" \
    --env "PORT=4321" \
    --env "NODE_ENV=production" \
    --env "OBJECT_STORAGE_PROVIDER=filesystem" \
    --env "DATABASE_URL=" \
    --env "BLOB_READ_WRITE_TOKEN=" \
    "$IMAGE_NAME"

  "$CONTAINER_BIN" "$@"
  echo "nima-tech-space is available at http://${BIND_ADDRESS}:${HOST_PORT}"
}

show_status() {
  "$CONTAINER_BIN" list --all
  echo "Local URL: http://${BIND_ADDRESS}:${HOST_PORT}"
}

require_container

case "${1:-}" in
  build)
    build_image
    ;;
  start)
    start_container
    ;;
  restart)
    start_container
    ;;
  stop)
    if container_exists; then
      "$CONTAINER_BIN" stop "$CONTAINER_NAME"
    else
      echo "Container $CONTAINER_NAME does not exist."
    fi
    ;;
  status)
    show_status
    ;;
  logs)
    "$CONTAINER_BIN" logs --follow "$CONTAINER_NAME"
    ;;
  *)
    usage
    exit 1
    ;;
esac
