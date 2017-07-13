FROM node:8.1.4-alpine
MAINTAINER Nick 'MorpheusXAUT' Mueller <nick@morpheusxaut.net>

ARG PRODUCTION_BUILD=true

RUN set -ex \
    && apk add --no-cache \
        netcat-openbsd \
        su-exec

RUN mkdir /app
WORKDIR /app

COPY . /app/

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
        && yarn cache clean \
        && apk del .build-deps-node; \
    fi

ENTRYPOINT [ "/app/docker-entrypoint.sh" ]
CMD [ "yarn", "start" ]