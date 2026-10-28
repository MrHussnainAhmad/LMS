#!/bin/sh
# Linux-only fixture. Does not run Docker or touch the real /backups volume.
set -eu
test "$(id -u)" = 0 || { echo 'SKIP: root is required to test UID/GID ownership'; exit 77; }
command -v setpriv >/dev/null || { echo 'SKIP: setpriv is required'; exit 77; }
directory=$(mktemp -d /tmp/nisaab360-backup-volume.XXXXXXXX)
cleanup() { rm -f "${directory}/backup-legacy.dump" "${directory}/backup-new.dump" "${directory}/backup-new.dump.enc" "${directory}/last-success" "${directory}/last-failure"; rmdir "${directory}"; }
trap cleanup EXIT
BACKUP_DIRECTORY="${directory}" sh backup/init-volume.sh
test "$(stat -c '%u:%g:%a' "${directory}")" = '1001:1001:700'
# Reproduce an old root-owned volume before testing upgrade initialization.
chown 0:0 "${directory}"
printf 'legacy fixture' > "${directory}/backup-legacy.dump"
chmod 644 "${directory}/backup-legacy.dump"
BACKUP_DIRECTORY="${directory}" sh backup/init-volume.sh
BACKUP_DIRECTORY="${directory}" sh backup/init-volume.sh
test "$(stat -c '%u:%g:%a' "${directory}")" = '1001:1001:700'
test "$(stat -c '%u:%g:%a' "${directory}/backup-legacy.dump")" = '1001:1001:600'
# Worker creates a private dump; each application replica can read/write.
setpriv --reuid=1001 --regid=1001 --clear-groups sh -c 'umask 077; cat "$1/backup-legacy.dump" >/dev/null; printf fixture > "$1/backup-new.dump"' sh "${directory}"
setpriv --reuid=1001 --regid=1001 --clear-groups sh -c 'umask 077; cat "$1/backup-new.dump" > "$1/backup-new.dump.enc"' sh "${directory}"
setpriv --reuid=1001 --regid=1001 --clear-groups sh -c 'cat "$1/backup-new.dump.enc" >/dev/null' sh "${directory}"
test "$(stat -c '%a' "${directory}/backup-new.dump")" = 600
test "$(stat -c '%a' "${directory}/backup-new.dump.enc")" = 600
setpriv --reuid=1001 --regid=1001 --clear-groups sh -c 'umask 077; date -u +%s > "$1/last-success"' sh "${directory}"
setpriv --reuid=1001 --regid=1001 --clear-groups env BACKUP_DIRECTORY="${directory}" sh backup/healthcheck.sh
setpriv --reuid=1001 --regid=1001 --clear-groups sh -c 'umask 077; date -u +%s > "$1/last-failure"' sh "${directory}"
if setpriv --reuid=1001 --regid=1001 --clear-groups env BACKUP_DIRECTORY="${directory}" sh backup/healthcheck.sh; then echo 'Healthcheck ignored latest failure' >&2; exit 1; fi
echo 'PASS: fresh/existing initialization, idempotency and shared UID access'
