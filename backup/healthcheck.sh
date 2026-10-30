#!/bin/sh
set -eu
if [ "$(id -u)" = 0 ]; then exec su-exec 1001:1001 "$0" "$@"; fi
directory="${BACKUP_DIRECTORY:-/backups}"
# Fresh installations may wait until the first 02:00 PKT run. Never create a startup snapshot.
marker="${directory}/last-success"
if [ ! -f "$marker" ]; then marker="${directory}/worker-started"; fi
test -f "$marker"
test ! -f "${directory}/last-failure"
age=$(($(date -u +%s) - $(cat "$marker")))
test "$age" -ge 0 && test "$age" -lt "${BACKUP_HEALTH_MAX_AGE_SECONDS:-97200}"
