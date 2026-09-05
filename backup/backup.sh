#!/bin/sh
set -eu

: "${POSTGRES_HOST:?POSTGRES_HOST is required}"
: "${POSTGRES_DATABASE:?POSTGRES_DATABASE is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${S3_ENDPOINT:?S3_ENDPOINT is required}"
: "${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID is required}"
: "${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"
: "${S3_PREFIX:?S3_PREFIX is required}"

timestamp=$(date -u +"%Y-%m-%dT%H%M%SZ")
filename="backup-${timestamp}.dump"
filepath="/backups/${filename}"
keep_days="${BACKUP_KEEP_DAYS:-30}"
trap 'rm -f "${filepath}.partial"' EXIT

mkdir -p /backups
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  --host="${POSTGRES_HOST}" --username="${POSTGRES_USER}" --dbname="${POSTGRES_DATABASE}" \
  --format=custom --compress=6 --no-owner --no-acl --file="${filepath}.partial"
pg_restore --list "${filepath}.partial" >/dev/null
mv "${filepath}.partial" "${filepath}"

mc alias set b2 "${S3_ENDPOINT}" "${S3_ACCESS_KEY_ID}" "${S3_SECRET_ACCESS_KEY}" --api S3v4 >/dev/null
mc cp "${filepath}" "b2/${S3_BUCKET}/${S3_PREFIX}/${filename}"
mc stat "b2/${S3_BUCKET}/${S3_PREFIX}/${filename}" >/dev/null

find /backups -type f -name 'backup-*.dump' -mtime "+${keep_days}" -delete
# Never let disaster-backup retention traverse tenant packages if the prefix is
# misconfigured. Remote deletion is allowed only inside this exact namespace.
if [ "${S3_PREFIX}" = "postgres-backups/disaster-recovery" ]; then
  mc rm --recursive --force --older-than "${keep_days}d" "b2/${S3_BUCKET}/${S3_PREFIX}/" >/dev/null 2>&1 || true
else
  echo "Skipping remote retention: unsafe S3_PREFIX=${S3_PREFIX}" >&2
fi
date -u +%s > /backups/last-success
echo "Verified database backup completed: ${filename}"
