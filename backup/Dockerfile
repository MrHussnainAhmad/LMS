FROM postgres:16-alpine

# Google Drive uploads use the application's authenticated cron endpoint.
# No MinIO client is needed for this deployment.
RUN apk add --no-cache curl openssl su-exec flock jq \
    && addgroup -g 1001 backup \
    && adduser -D -H -u 1001 -G backup backup
ENV TZ=UTC

COPY backup.sh /backup.sh
COPY entrypoint.sh /entrypoint.sh
COPY init-volume.sh /init-volume.sh
COPY healthcheck.sh /healthcheck.sh
RUN sed -i 's/\r$//' /backup.sh /entrypoint.sh /init-volume.sh /healthcheck.sh \
    && chmod +x /backup.sh /entrypoint.sh /init-volume.sh /healthcheck.sh

ENTRYPOINT ["/entrypoint.sh"]
