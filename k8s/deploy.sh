#!/bin/bash

if [ -z $1 ]; then
    echo "Provide image tag as parameter"
    exit 1
fi

kubectl --namespace slotlist set image deploy/slotlist-frontend slotlist-frontend=eu.gcr.io/slotlist-info/slotlist/frontend:$1