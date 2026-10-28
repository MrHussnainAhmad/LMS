#!/bin/sh
set -eu
if [ "$(id -u)" = 0 ]; then exec su-exec 1001:1001 "$0" "$@"; fi
directory="${BACKUP_DIRECTORY:-/backups}"
test -f "${directory}/last-success"
test ! -f "${directory}/last-failure"
age=$(($(date -u +%s) - $(cat "${directory}/last-success")))
test "${age}" -ge 0 && test "${age}" -lt "${BACKUP_HEALTH_MAX_AGE_SECONDS:-129600}"
