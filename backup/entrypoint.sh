#!/bin/sh
set -eu
umask 077

if [ "${1:-}" = '--init-volume' ]; then exec /init-volume.sh; fi
export TZ=UTC
schedule="${SCHEDULE:-0 0 * * *}"
case "${schedule}" in *[!0-9\ ,*/-]*) echo 'Invalid numeric cron schedule' >&2; exit 1 ;; esac
test "$(printf '%s' "${schedule}" | awk '{ print NF }')" = 5 || { echo 'Expected five cron fields' >&2; exit 1; }
printf '%s %s\n' "${schedule}" '/backup.sh >> /proc/1/fd/1 2>> /proc/1/fd/2' > /etc/crontabs/root
# Independently bound plaintext lifetime after SIGKILL/OOM/host reboot.
printf '%s\n' '17 * * * * /backup.sh --cleanup >> /proc/1/fd/1 2>> /proc/1/fd/2' >> /etc/crontabs/root

if [ "${BACKUP_ON_STARTUP:-true}" = "true" ]; then
  if ! /backup.sh; then
    echo "Initial backup failed; the scheduled job will retry at ${schedule}." >&2
  fi
fi

exec crond -f -d 8
