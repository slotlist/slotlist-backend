#!/bin/sh

set -e

if [ "$1" == "node" ] || [ "$1" == "nodemon" ] || [ "$1" == "yarn" ] || [ "$1" == "npm" ]; then
    if [[ -z "${CONFIG_DATABASE_HOST}" ]]; then
        echo "No environment variable set for database host, cannot continue"
        exit 1
    fi

    if [[ -z "${CONFIG_DATABASE_PORT}" ]]; then
        echo "No environment variable set for database port, cannot continue"
        exit 1
    fi

    echo "$(date) - Waiting for Postgres connection"
    until nc -z $CONFIG_DATABASE_HOST $CONFIG_DATABASE_PORT; do
        echo -n "."
        sleep 1
    done
    echo ""
    echo "$(date) - Postgres connection opened"

    exec su-exec node "$@"
fi

exec "$@"