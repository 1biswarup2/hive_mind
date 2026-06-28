#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  cp .env.example .env
  SECRET=$(openssl rand -hex 32)
  sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${SECRET}/" .env
  echo "Created .env with a random JWT_SECRET."
  echo "Review .env before going live."
fi

docker compose up -d --build

echo ""
echo "Jamoora is starting."
echo "  URL:  http://localhost:${APP_PORT:-80}"
echo "  Health: http://localhost:${APP_PORT:-80}/api/health"
echo ""
echo "First visit → Sign in → New org → create your company account."
