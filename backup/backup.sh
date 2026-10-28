#!/bin/sh
set -eu
if [ "$(id -u)" = 0 ]; then exec su-exec 1001:1001 "$0" "$@"; fi
test "$(id -u):$(id -g)" = '1001:1001' || { echo 'Incorrect backup worker identity' >&2; exit 1; }
umask 077
test -w /backups || { echo 'Backup volume initialization is missing' >&2; exit 1; }
exec 9>/backups/.backup.lock
flock -n 9 || { echo 'Backup job already running; skipping overlapping invocation'; exit 0; }

# Reap only known temporary dump files older than two hours, under the same lock.
# Cron runs this hourly even after a failed backup. Retained Drive backups and
# records are never involved. The active job is protected by flock.
find /backups -maxdepth 1 -type f \( -name 'backup-*.dump' -o -name 'backup-*.dump.partial' -o -name 'backup-*.dump.enc' \) -mmin +120 -delete
if [ "${1:-}" = '--cleanup' ]; then exit 0; fi

filepath=''
success=false
cleanup() {
  if [ -n "${filepath}" ]; then rm -f "${filepath}" "${filepath}.partial" "${filepath}.enc"; fi
  if [ "${success}" != true ]; then
    date -u +%s > /backups/last-failure
    echo 'Database backup failed; last-failure recorded for health monitoring' >&2
  fi
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
date -u +%s > /backups/last-attempt
: "${POSTGRES_HOST:?POSTGRES_HOST is required}"
: "${POSTGRES_DATABASE:?POSTGRES_DATABASE is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${CENTRAL_DATABASE_BACKUP_DRIVE_FOLDER_ID:?Central Drive backup folder is required}"
: "${CRON_SECRET:?CRON_SECRET is required}"

timestamp=$(date -u +'%Y-%m-%dT%H%M%SZ')
nonce=$(openssl rand -hex 8)
filename="backup-${timestamp}-${nonce}.dump"
filepath="/backups/${filename}"
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  --host="${POSTGRES_HOST}" --username="${POSTGRES_USER}" --dbname="${POSTGRES_DATABASE}" \
  --format=custom --compress=6 --no-owner --no-acl --file="${filepath}.partial"
pg_restore --list "${filepath}.partial" >/dev/null
mv "${filepath}.partial" "${filepath}"
chmod 600 "${filepath}"
echo "Verified database dump completed: ${filename}"

drive_date=$(date -u +'%Y-%m-%d-%H-%M')
drive_filename="database-${drive_date}-${nonce}.dump"
run_id="central-${drive_date}-${nonce}"
raw_sha256=$(sha256sum "${filepath}" | cut -d' ' -f1)
raw_size=$(stat -c%s "${filepath}")
# Use the same idempotency key for bounded retries. Never put CRON_SECRET on
# curl's command line or print the response/provider error body to container logs.
attempt=1
while :; do
  code=$(printf 'header = "Authorization: Bearer %s"\n' "${CRON_SECRET}" | curl -s \
    --config - --connect-timeout 10 --max-time 3300 --output /dev/null --write-out '%{http_code}' \
    -X POST 'http://app:3000/api/cron/central-backup' -H 'Content-Type: application/json' \
    -d "{\"runId\":\"${run_id}\",\"fileName\":\"${drive_filename}\",\"filePath\":\"${filepath}\",\"fileSizeBytes\":${raw_size},\"sha256\":\"${raw_sha256}\"}") || code=000
  if [ "${code}" = 200 ]; then break; fi
  echo "Central backup attempt ${attempt} failed (HTTP ${code})" >&2
  if [ "${attempt}" -ge 3 ]; then exit 1; fi
  case "${code}" in 000|409|429|5??) ;; *) exit 1 ;; esac
  attempt=$((attempt + 1))
  sleep 30
done
date -u +%s > /backups/last-success
rm -f /backups/last-failure
success=true
echo "Encrypted Google Drive backup completed: ${run_id}"
