#!/bin/bash
# Подготовка к развёртыванию Canton Validator в Kubernetes по официальной документации (Helm + DevNet)
# Полная инструкция: CANTON_OFFICIAL_K8S_DEVNET_GUIDE.md

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
CONFIG_DIR="$PROJECT_ROOT/config"
BLOCKCHAIN_CONFIG="$PROJECT_ROOT/blockchain/config"
SECRETS_FILE="${BLOCKCHAIN_CONFIG}/onboarding-secrets.env"

# Параметры
NS="${CANTON_NAMESPACE:-validator}"
CHART_VERSION="${CHART_VERSION:-0.5.7}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
ok() { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
err() { echo -e "${RED}❌ $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Canton Validator — подготовка к Helm-деплою в K8s (DevNet)"
echo "  Namespace: $NS   Chart version: $CHART_VERSION"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 1. Namespace
info "1. Создание namespace $NS"
if kubectl get ns "$NS" &>/dev/null; then
  ok "Namespace $NS уже существует"
else
  kubectl create ns "$NS" && ok "Namespace $NS создан" || { err "Не удалось создать namespace"; exit 1; }
fi

# 2. PostgreSQL secret
info "2. Секрет PostgreSQL (postgres-secrets)"
if kubectl get secret postgres-secrets -n "$NS" &>/dev/null; then
  ok "Секрет postgres-secrets уже есть"
else
  if [ -z "${POSTGRES_PASSWORD}" ]; then
    read -sp "Задайте пароль PostgreSQL (POSTGRES_PASSWORD): " POSTGRES_PASSWORD
    echo ""
  fi
  if [ -z "${POSTGRES_PASSWORD}" ]; then
    err "POSTGRES_PASSWORD не задан"; exit 1
  fi
  kubectl create secret generic postgres-secrets \
    --from-literal=postgresPassword="${POSTGRES_PASSWORD}" \
    -n "$NS" && ok "Секрет postgres-secrets создан" || { err "Не удалось создать postgres-secrets"; exit 1; }
fi

# 3. Onboarding secret (DevNet)
info "3. Onboarding secret для DevNet"
if kubectl get secret splice-app-validator-onboarding-validator -n "$NS" &>/dev/null; then
  warn "Секрет splice-app-validator-onboarding-validator уже есть (обновить вручную при истечении)"
else
  ONBOARDING_SECRET="${ONBOARDING_SECRET:-}"
  if [ -z "$ONBOARDING_SECRET" ] && [ -f "$SECRETS_FILE" ]; then
    ONBOARDING_SECRET=$(grep "^DEVNET_ONBOARDING_SECRET=" "$SECRETS_FILE" 2>/dev/null | cut -d'=' -f2-)
  fi
  if [ -z "$ONBOARDING_SECRET" ]; then
    info "Получение DevNet onboarding secret (действует 1 час)..."
    ONBOARDING_SECRET=$("$SCRIPT_DIR/get-onboarding-secret.sh" devnet 2>/dev/null || true)
  fi
  if [ -z "$ONBOARDING_SECRET" ]; then
    err "Не удалось получить onboarding secret. Выполните: ./scripts/get-onboarding-secret.sh devnet --save"
    exit 1
  fi
  kubectl create secret generic splice-app-validator-onboarding-validator \
    --from-literal=secret="${ONBOARDING_SECRET}" \
    -n "$NS" && ok "Секрет splice-app-validator-onboarding-validator создан" || { err "Не удалось создать onboarding secret"; exit 1; }
fi

echo ""
info "Дальнейшие шаги (официальный Helm, см. CANTON_OFFICIAL_K8S_DEVNET_GUIDE.md):"
echo ""
echo "  1) Скачать бандл с values:"
echo "     export CHART_VERSION=$CHART_VERSION"
echo "     curl -sL -o /tmp/splice-node.tar.gz \\"
echo "       \"https://github.com/digital-asset/decentralized-canton-sync/releases/download/v\${CHART_VERSION}/\${CHART_VERSION}_splice-node.tar.gz\""
echo "     mkdir -p /tmp/splice-node && tar xzvf /tmp/splice-node.tar.gz -C /tmp/splice-node"
echo ""
echo "  2) Отредактировать values для DevNet (MIGRATION_ID, SPONSOR_SV_URL, TRUSTED_SCAN_URL, party hint, при необходимости disableAuth: true и nodeSelector)."
echo ""
echo "  3) Установить чарты по порядку:"
echo "     helm install postgres oci://ghcr.io/digital-asset/decentralized-canton-sync/helm/splice-postgres \\"
echo "       -n $NS --version \${CHART_VERSION} -f /tmp/splice-node/splice-node/examples/sv-helm/postgres-values-validator-participant.yaml --wait"
echo "     helm install participant oci://ghcr.io/digital-asset/decentralized-canton-sync/helm/splice-participant \\"
echo "       -n $NS --version \${CHART_VERSION} -f .../participant-values.yaml -f .../standalone-participant-values.yaml --wait"
echo "     helm install validator oci://ghcr.io/digital-asset/decentralized-canton-sync/helm/splice-validator \\"
echo "       -n $NS --version \${CHART_VERSION} -f .../validator-values.yaml -f .../standalone-validator-values.yaml --wait"
echo ""
echo "  Детали и параметры DevNet: CANTON_OFFICIAL_K8S_DEVNET_GUIDE.md"
echo "═══════════════════════════════════════════════════════════"
echo ""
