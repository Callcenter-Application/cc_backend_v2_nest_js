#!/bin/sh
# Starts the app, seeds the first Administrator user once the schema is
# ready (seed script itself retries while TypeORM synchronizes), then keeps
# the app as the container's foreground process.

npm run start:dev &
APP_PID=$!

npm run seed:admin:docker || echo "Warning: admin seed failed, continuing" >&2

wait "$APP_PID"
