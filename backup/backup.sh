#!/bin/sh
set -e

TIMESTAMP=$(date +"%Y-%m-%dT%H%M%S")
FILENAME="backup-${TIMESTAMP}.sql.gz"
FILEPATH="/tmp/${FILENAME}"

echo "Dumping database..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -h "${POSTGRES_HOST}" -U "${POSTGRES_USER}" "${POSTGRES_DATABASE}" | gzip > "${FILEPATH}"

echo "Uploading to B2..."
mc alias set b2 "${S3_ENDPOINT}" "${S3_ACCESS_KEY_ID}" "${S3_SECRET_ACCESS_KEY}" --api S3v4
mc cp "${FILEPATH}" "b2/${S3_BUCKET}/${S3_PREFIX}/${FILENAME}"

echo "Cleaning up..."
rm "${FILEPATH}"

echo "Backup complete: ${FILENAME}"
