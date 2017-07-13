FROM node:8.1.4-alpine
MAINTAINER Nick 'MorpheusXAUT' Mueller <nick@morpheusxaut.net>

RUN set -ex \
    && apk add --no-cache \
        netcat-openbsd \
        su-exec

RUN mkdir -p /app/dist
WORKDIR /app
VOLUME /app/dist

COPY . /app/

RUN set -ex \
    && apk add --no-cache --virtual .build-deps-node \
        g++ \
        make \
        postgresql-dev \
        python2 \
    && yarn install \
    && yarn build \
    && yarn install --prod \
    && yarn cache clean \
    && apk del .build-deps-node

ENTRYPOINT [ "/app/docker-entrypoint.sh" ]
CMD [ "yarn", "start" ]