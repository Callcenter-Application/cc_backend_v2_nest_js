#!/bin/sh
# Applies pending migrations (when TypeORM synchronize is off, e.g. Supabase),
# then runs the app as the container's foreground process.

if [ "$DB_SYNCHRONIZE" != "true" ]; then
  npm run migration:run:docker || { echo "Error: migrations failed" >&2; exit 1; }
fi

exec npm run start:dev
