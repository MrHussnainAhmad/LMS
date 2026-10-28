#!/bin/sh
set -eu
# This is the only privileged volume operation. Run before app/app2/cron start.
# UID/GID are fixed in both images, including when upgrading the old nogroup image.
test "$(id -u)" = 0 || { echo 'Volume initialization requires root' >&2; exit 1; }
directory="${BACKUP_DIRECTORY:-/backups}"
case "${directory}" in /|'') echo 'Invalid backup directory' >&2; exit 1 ;; /*) ;; *) exit 1 ;; esac
mkdir -p "${directory}"
test "$(readlink -f "${directory}")" = "${directory}" || { echo 'Refusing a symlink backup directory' >&2; exit 1; }
chown 1001:1001 "${directory}"
chmod 700 "${directory}"
# Repair only known top-level runtime files on existing volumes, never recursive.
# No files are deleted by initialization.
find "${directory}" -maxdepth 1 -type f \( -name 'backup-*.dump' -o -name 'backup-*.dump.partial' -o -name 'backup-*.dump.enc' -o -name 'last-*' -o -name '.backup.lock' \) \
  -exec chown 1001:1001 {} \; -exec chmod 600 {} \;
echo 'Backup volume initialized for UID/GID 1001:1001'
