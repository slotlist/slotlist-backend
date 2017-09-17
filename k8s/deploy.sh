#!/bin/bash

if [ -z $1 ]; then
    echo "Provide image tag as parameter"
    exit 1
fi

kubectl --namespace slotlist set image deploy/slotlist-backend slotlist-backend=eu.gcr.io/slotlist-info/slotlist/backend:$1