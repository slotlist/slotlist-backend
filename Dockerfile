ARG NODE_VERSION=8.1.4-alpine
FROM node:${NODE_VERSION}

ARG PRODUCTION_BUILD=true

RUN set -ex \
    && apk add --no-cache \
        libc6-compat \
        libpq \
        netcat-openbsd \
        su-exec

RUN mkdir /app
WORKDIR /app

COPY . /app/

RUN chmod +x /app/docker-entrypoint.sh

RUN set -ex \
    && apk add --no-cache --virtual .build-deps-node \
        g++ \
        make \
        postgresql-dev \
        python2 \
    && yarn install \
    && if [ "$PRODUCTION_BUILD" == "true" ]; then \
        yarn build \
        && yarn install --prod \
        && yarn cache clean; \
    fi \
    && apk del .build-deps-node

ENTRYPOINT [ "/app/docker-entrypoint.sh" ]
CMD [ "yarn", "start:docker" ]
