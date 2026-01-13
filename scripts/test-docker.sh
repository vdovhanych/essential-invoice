#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

cleanup() {
  docker compose down -v --remove-orphans
}

trap cleanup EXIT

docker compose build
docker compose up -d

for i in {1..30}; do
  if curl -fsS http://localhost:3000/health > /dev/null; then
    echo "App is healthy."
    exit 0
  fi
  sleep 2
done

echo "App failed to become healthy in time." >&2
docker compose logs app >&2 || true
exit 1
