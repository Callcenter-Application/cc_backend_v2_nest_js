#!/bin/sh
# Applies pending migrations (when TypeORM synchronize is off, e.g. Supabase),
# starts the app, seeds the first Administrator user once the schema is ready
# (the seed script itself retries while the schema is being created), then
# keeps the app as the container's foreground process.

if [ "$DB_SYNCHRONIZE" != "true" ]; then
  npm run migration:run:docker || { echo "Error: migrations failed" >&2; exit 1; }
fi

npm run start:dev &
APP_PID=$!

npm run seed:admin:docker || echo "Warning: admin seed failed, continuing" >&2

wait "$APP_PID"
