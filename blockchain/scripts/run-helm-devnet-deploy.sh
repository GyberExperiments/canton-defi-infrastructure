#!/bin/bash
# Полный деплой Canton Validator в K8s: скачивание бандла, postgres → participant → validator (DevNet).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLOCKCHAIN_ROOT="$(dirname "$SCRIPT_DIR")"
HELM_DEVNET="$BLOCKCHAIN_ROOT/k8s/helm-devnet"
NS="${CANTON_NAMESPACE:-validator}"
CHART_VERSION="${CHART_VERSION:-0.5.7}"
BUNDLE_DIR="${BUNDLE_DIR:-/tmp/splice-node}"
BUNDLE_URL="https://github.com/digital-asset/decentralized-canton-sync/releases/download/v${CHART_VERSION}/${CHART_VERSION}_splice-node.tar.gz"

ok() { echo "✅ $1"; }
warn() { echo "⚠️  $1"; }
err() { echo "❌ $1"; exit 1; }
info() { echo "ℹ️  $1"; }

echo "Canton Validator — Helm deploy (DevNet) NS=$NS CHART_VERSION=$CHART_VERSION"

kubectl get ns "$NS" &>/dev/null || err "Namespace $NS не найден"
kubectl get secret postgres-secrets -n "$NS" &>/dev/null || err "postgres-secrets отсутствует"
kubectl get secret splice-app-validator-onboarding-validator -n "$NS" &>/dev/null || err "onboarding secret отсутствует"
ok "Секреты есть"

info "Скачивание бандла..."
mkdir -p "$BUNDLE_DIR"
curl -sL --retry 2 --max-time 300 -o "$BUNDLE_DIR/splice-node.tar.gz" "$BUNDLE_URL" || err "Не удалось скачать бандл"
ok "Бандл скачан"
tar xzf "$BUNDLE_DIR/splice-node.tar.gz" -C "$BUNDLE_DIR"
SV_HELM=$(find "$BUNDLE_DIR" -name "postgres-values-validator-participant.yaml" -path "*/sv-helm/*" 2>/dev/null | head -1 | xargs dirname)
[ -n "$SV_HELM" ] && [ -f "$SV_HELM/postgres-values-validator-participant.yaml" ] || err "В бандле не найден sv-helm"
ok "Values: $SV_HELM"

info "1/3 postgres..."
helm upgrade --install postgres oci://ghcr.io/digital-asset/decentralized-canton-sync/helm/splice-postgres \
  -n "$NS" --version "$CHART_VERSION" \
  -f "$SV_HELM/postgres-values-validator-participant.yaml" \
  -f "$HELM_DEVNET/postgres-values-devnet.yaml" \
  --wait
ok "postgres готов"

info "2/3 participant..."
helm upgrade --install participant oci://ghcr.io/digital-asset/decentralized-canton-sync/helm/splice-participant \
  -n "$NS" --version "$CHART_VERSION" \
  -f "$SV_HELM/participant-values.yaml" \
  -f "$SV_HELM/standalone-participant-values.yaml" \
  -f "$HELM_DEVNET/participant-values-devnet.yaml" \
  -f "$HELM_DEVNET/standalone-participant-values-devnet.yaml" \
  --wait
ok "participant готов"

info "3/3 validator..."
helm upgrade --install validator oci://ghcr.io/digital-asset/decentralized-canton-sync/helm/splice-validator \
  -n "$NS" --version "$CHART_VERSION" \
  -f "$SV_HELM/validator-values.yaml" \
  -f "$SV_HELM/standalone-validator-values.yaml" \
  -f "$HELM_DEVNET/validator-values-devnet.yaml" \
  -f "$HELM_DEVNET/standalone-validator-values-devnet.yaml" \
  --wait
ok "validator установлен"

echo "Деплой завершён. kubectl get pods -n $NS"
