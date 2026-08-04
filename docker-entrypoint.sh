#!/bin/sh
set -e

echo "==> Applying database migrations"
npx prisma migrate deploy

if [ "${SEED_ON_BOOT}" = "true" ]; then
  echo "==> Seeding database"
  node dist/prisma/seed.js
fi

exec "$@"
