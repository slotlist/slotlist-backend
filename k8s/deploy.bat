@echo off

if "%1"=="" (
    echo "Provide image tag as parameter"
    exit 1
)

kubectl --namespace slotlist set image deploy/slotlist-backend slotlist-backend=eu.gcr.io/slotlist-info/slotlist/backend:%1
