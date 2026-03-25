#!/bin/bash
# Проверка готовности ноды к DevNet
# Запуск: ./scripts/verify-devnet-ready.sh
# Или с сервера: NODE_URL=http://localhost:8080 ./scripts/verify-devnet-ready.sh

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

NODE_URL="${NODE_URL:-http://65.108.15.30:8080}"
DEVNET_SCAN="${DEVNET_SCAN:-https://scan.sv-1.dev.global.canton.network.sync.global}"

ok() { echo -e "${GREEN}✅ $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Проверка готовности ноды к DevNet"
echo "  Нода: $NODE_URL"
echo "═══════════════════════════════════════════════════════════"
echo ""

ERR=0

# 1. Health
info "1. Health endpoint"
if health=$(curl -sS -m 10 "$NODE_URL/health" 2>/dev/null); then
  if [ "$health" = "healthy" ]; then
    ok "Health: $health"
  else
    warn "Health ответ: $health"
  fi
else
  fail "Health недоступен (проверьте URL и порт 8080)"
  ERR=$((ERR+1))
fi

# 2. Validator version
info "2. Validator API (версия Canton)"
if ver=$(curl -sS -m 10 "$NODE_URL/api/validator/version" 2>/dev/null); then
  if echo "$ver" | grep -q '"version"'; then
    version=$(echo "$ver" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
    ok "Canton version: $version"
  else
    warn "Ответ: $ver"
  fi
else
  fail "Validator version недоступен"
  ERR=$((ERR+1))
fi

# 3. Config / frontend
info "3. Frontend config (config.js)"
if config=$(curl -sS -m 10 "$NODE_URL/config.js" 2>/dev/null); then
  if echo "$config" | grep -q "splice_config"; then
    ok "Config.js доступен (splice_config)"
  else
    warn "Config.js без splice_config"
  fi
else
  warn "Config.js недоступен"
fi

# 4. Wallet UI
info "4. Wallet UI"
if code=$(curl -sS -m 10 -o /dev/null -w "%{http_code}" "$NODE_URL/wallet/" 2>/dev/null); then
  if [ "$code" = "200" ]; then
    ok "Wallet UI: HTTP $code"
  else
    warn "Wallet UI: HTTP $code"
  fi
else
  warn "Wallet UI недоступен"
fi

# 5. DevNet Scan API (с текущей машины; с сервера ноды обычно доступен)
info "5. DevNet Scan API (доступность с этой машины)"
if curl -sS -m 15 "$DEVNET_SCAN/api/scan/v0/scans" 2>/dev/null | grep -q '"scans"'; then
  ok "DevNet Scan API доступен"
else
  warn "DevNet Scan API недоступен с этой машины (нормально, если проверка не с ноды 65.108.15.30)"
fi

# 6. Kubernetes (если нода должна быть в кубере)
info "6. Kubernetes (namespace canton-node)"
if kubectl get ns canton-node &>/dev/null; then
  pods=$(kubectl get pods -n canton-node -l app=canton-validator --no-headers 2>/dev/null | wc -l)
  if [ "${pods:-0}" -gt 0 ]; then
    ok "Namespace canton-node есть, подов canton-validator: $pods"
    kubectl get pods -n canton-node -l app=canton-validator --no-headers 2>/dev/null | while read line; do echo "    $line"; done
  else
    warn "Namespace canton-node есть, но подов canton-validator нет"
  fi
else
  warn "Namespace canton-node не найден (нода может работать через Docker на хосте)"
  echo "    Развернуть в K8s: kubectl create ns canton-node && kubectl apply -f k8s/canton-validator-full-stack.yaml"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
if [ $ERR -eq 0 ]; then
  ok "Нода готова к работе с DevNet (health + validator API в норме)."
  echo ""
  info "По проекту нода в K8s: namespace canton-node, k8s/canton-validator-full-stack.yaml"
  info "Если нода в Docker на хосте — проверка на сервере:"
  echo "  ssh root@65.108.15.30 'cd /opt/canton-validator && docker ps --format \"table {{.Names}}\t{{.Status}}\"'"
  echo ""
  info "Onboarding secret DevNet действует 1 час. Обновить:"
  echo "  ./scripts/get-onboarding-secret.sh devnet --save"
else
  fail "Обнаружены проблемы ($ERR). Проверьте доступность ноды и порт 8080."
fi
echo "═══════════════════════════════════════════════════════════"
echo ""

exit $ERR
