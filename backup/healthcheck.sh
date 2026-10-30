#!/bin/sh
set -eu
if [ "$(id -u)" = 0 ]; then exec su-exec 1001:1001 "$0" "$@"; fi

directory="${BACKUP_DIRECTORY:-/backups}"
# Readiness means that the worker can accept a new backup. Historical failures
# must not block the website and prevent the administrator from trying again.
test -w "$directory"
curl -fsS --connect-timeout 2 --max-time 3 http://127.0.0.1:8788/health >/dev/null
