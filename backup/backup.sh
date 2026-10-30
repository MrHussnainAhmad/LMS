#!/bin/sh
set -eu
if [ "$(id -u)" = 0 ]; then exec su-exec 1001:1001 "$0" "$@"; fi
umask 077
test "$(id -u):$(id -g)" = '1001:1001' && test -w /backups
: "${CRON_SECRET:?CRON_SECRET required}"
control() {
 printf 'header = "Authorization: Bearer %s"\n' "${CRON_SECRET}" | curl -fsS --config - --connect-timeout 10 --max-time 220 -X POST \
  http://app:3000/api/cron/central-backup/control -H 'Content-Type: application/json' -d "$1"
}
# Schedule enqueues before the local worker lock, so a concurrent poll cannot lose the nightly job.
if [ "${1:-}" = '--nightly' ]; then control '{"action":"nightly"}' >/dev/null; fi
exec 9>/backups/.backup.lock
if ! flock -n 9; then
 [ "${1:-}" != '--manual' ] || exit 75
 exit 0
fi
find /backups -maxdepth 1 -type f \( -name 'backup-*.dump' -o -name 'backup-*.dump.partial' -o -name 'backup-*.dump.enc' -o -name 'backup-*.dump.package' -o -name 'backup-*.started' \) -mmin +120 -delete
delivery='{}'
if [ "${1:-}" != '--manual' ]; then delivery=$(control '{"action":"retry-email"}' || printf '{}'); fi
if [ "$(printf '%s' "$delivery" | jq -r '.delivered // 0')" -gt 0 ]; then
 latest_epoch=$(printf '%s' "$delivery" | jq -r '.latestSuccessEpoch // 0')
 if [ "$latest_epoch" -gt 0 ]; then printf '%s\n' "$latest_epoch" > /backups/last-success; rm -f /backups/last-failure; fi
fi
if [ "${1:-}" = '--manual' ]; then
 case "${2:-}" in ''|*[!A-Za-z0-9_-]*) exit 1 ;; esac
 job=$(control "{\"action\":\"claim\",\"runId\":\"${2}\"}")
else
 job=$(control '{"action":"claim"}')
fi
run_id=$(printf '%s' "$job" | jq -r '.job.runId // empty')
[ -n "$run_id" ] || exit 0
case "$run_id" in *[!A-Za-z0-9_-]*) exit 1 ;; esac
filename=$(printf '%s' "$job" | jq -r '.job.fileName')
filepath="/backups/backup-${run_id}.dump"
success=false
cleanup() {
 rm -f "$filepath" "${filepath}.partial" "${filepath}.enc" "${filepath}.package"
 if [ "$success" = true ]; then
  date -u +%s > /backups/last-success; rm -f /backups/last-failure
  control "{\"action\":\"finish\",\"runId\":\"${run_id}\",\"success\":true}" >/dev/null || true
 else
  date -u +%s > /backups/last-failure
  control "{\"action\":\"finish\",\"runId\":\"${run_id}\",\"success\":false}" >/dev/null || true
 fi
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
date -u +%s > /backups/last-attempt
: "${POSTGRES_HOST:?Required}"
: "${POSTGRES_DATABASE:?Required}"
: "${POSTGRES_USER:?Required}"
: "${POSTGRES_PASSWORD:?Required}"
date -u +%s > "/backups/backup-${run_id}.started"
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump --host="${POSTGRES_HOST}" --username="${POSTGRES_USER}" --dbname="${POSTGRES_DATABASE}" \
 --format=custom --compress=6 --no-owner --no-acl --file="${filepath}.partial"
pg_restore --list "${filepath}.partial" >/dev/null
mv "${filepath}.partial" "$filepath"
raw_sha256=$(sha256sum "$filepath" | cut -d' ' -f1)
raw_size=$(stat -c%s "$filepath")
attempt=1
while :; do
 code=$(printf 'header = "Authorization: Bearer %s"\n' "${CRON_SECRET}" | curl -s --config - --connect-timeout 10 --max-time 3300 --output /dev/null --write-out '%{http_code}' \
 -X POST http://app:3000/api/cron/central-backup -H 'Content-Type: application/json' \
 -d "{\"runId\":\"${run_id}\",\"fileName\":\"${filename}\",\"filePath\":\"${filepath}\",\"fileSizeBytes\":${raw_size},\"sha256\":\"${raw_sha256}\"}") || code=000
 if [ "$code" = 200 ]; then success=true; break; fi
 echo "Database backup upload/delivery attempt ${attempt} failed (HTTP ${code}); recovery email retries remain queued."
 [ "$attempt" -lt 3 ] || exit 1
 case "$code" in 000|409|429|5??) ;; *) exit 1 ;; esac
 attempt=$((attempt+1)); sleep 30
done
