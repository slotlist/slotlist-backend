#!/bin/bash

# check for required files
if [ ! -f credentials.json ]; then
    echo "Missing credentials.json"
    exit 1
fi
if [ ! -f backend-secrets.yaml ]; then
    echo "Missing backend-secrets.yaml"
    exit 1
fi
if [ ! -f postgres-secrets.yaml ]; then
    echo "Missing postgres-secrets.yaml"
    exit 1
fi
if [ ! -f traefik-cloudflare.yaml ]; then
    echo "Missing traefik-cloudflare.yaml"
    exit 1
fi
if [ ! -f traefik-config.yaml ]; then
    echo "Missing traefik-config.yaml"
    exit 1
fi

set -ex

# misc tasks
kubectl create namespace slotlist

# set up postgres
kubectl create -f postgres-secrets.yaml
kubectl create -f postgres-volume.yaml
kubectl create -f postgres-deployment.yaml
kubectl create -f postgres-service.yaml

# run backend database migration
kubectl create -f backend-migration-job.yaml

# set up backend
kubectl create -f backend-secrets.yaml
kubectl --namespace slotlist create secret generic slotlist-backend-credentials --from-file=credentials.json
kubectl create -f backend-deployment.yaml
kubectl create -f backend-service.yaml
kubectl create -f backend-ingress.yaml

# set up consul
kubectl create -f consul-statefulset.yaml

# set up traefik config first
kubectl create -f traefik-cloudflare.yaml
kubectl create -f traefik-config.yaml

# populate consul with traefik config
kubectl create -f traefik-populate-job.yaml
kubectl --namespace kube-system exec -it traefik-consul-0 consul kv delete traefik/acme/storagefile

# set up k8s cluster role binding and traefik rbac
kubectl create clusterrolebinding cluster-admin-binding --clusterrole=cluster-admin --user="nick@morpheusxaut.net"
kubectl create -f traefik-rbac.yaml

# set up rest of traefik
kubectl create -f traefik-daemonset.yaml
kubectl create -f traefik-service.yaml

# set up pghero
kubectl create -f pghero-deployment.yaml
kubectl create -f pghero-service.yaml