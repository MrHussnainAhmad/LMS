#!/bin/sh
set -eu
umask 077
if [ "${1:-}" = '--init-volume' ]; then exec /init-volume.sh; fi
export TZ=UTC
# Pakistan is UTC+05:00. One scheduled job at 02:00 Asia/Karachi.
printf '%s\n' '0 21 * * * /backup.sh --nightly >> /proc/1/fd/1 2>> /proc/1/fd/2' > /etc/crontabs/root
# Poll only manually queued jobs and retry password delivery; this does not create extra snapshots.
printf '%s\n' '* * * * * /backup.sh --poll >> /proc/1/fd/1 2>> /proc/1/fd/2' >> /etc/crontabs/root
su-exec 1001:1001 sh -c 'date -u +%s > /backups/worker-started'
crond -b -l 8
exec su-exec 1001:1001 node /control-server.cjs
