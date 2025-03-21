#!/bin/sh
set -e

# If RUN_AS_UID and RUN_AS_GID are provided, use them to run the process
if [ -n "$RUN_AS_UID" ] && [ -n "$RUN_AS_GID" ]; then
  echo "Overriding default user: running as UID: $RUN_AS_UID, GID: $RUN_AS_GID"
  # Adjust ownership of /app directory
  chown -R $RUN_AS_UID:$RUN_AS_GID /app
  # If su-exec is available, drop privileges
  if command -v su-exec >/dev/null 2>&1; then
    exec su-exec $RUN_AS_UID:$RUN_AS_GID "$@"
  else
    echo "su-exec not found; running as root"
    exec "$@"
  fi
else
  # No override provided; execute command as the default (nextjs) user
  exec "$@"
fi
