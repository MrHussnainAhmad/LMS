FROM postgres:16-alpine

RUN apk add --no-cache curl \
    && curl -fL -o mc https://dl.min.io/client/mc/release/linux-amd64/mc \
    && chmod +x mc \
    && mv mc /usr/local/bin/

COPY backup.sh /backup.sh
RUN chmod +x /backup.sh

RUN echo "${SCHEDULE:-@daily} /backup.sh" > /etc/crontabs/root

CMD crond -f -d 8
