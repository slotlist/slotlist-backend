FROM node:8.1.3-alpine
MAINTAINER Nick 'MorpheusXAUT' Mueller <nick@morpheusxaut.net>

RUN mkdir /app
WORKDIR /app

COPY . /app/

RUN apk add --no-cache --virtual .build-deps-node \
        g++ \
        make \
        postgresql-dev \
        python2 \
    && yarn install \
    && yarn build \
    && yarn install --prod \
    && yarn cache clean \
    && apk del .build-deps-node

CMD [ "yarn", "start" ]