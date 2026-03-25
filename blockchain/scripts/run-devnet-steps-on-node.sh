#!/bin/bash
# Запуск шагов DevNet (get secret → update K8s secret → helm deploy) НА НОДЕ 65.108.15.30 по SSH.
# API DevNet и kubectl/helm должны выполняться с машины с egress IP 65.108.15.30.
# Использование: ./run-devnet-steps-on-node.sh [путь_к_blockchain_на_ноде]
# Репо на ноде должен быть уже склонирован (или скопирован).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLOCKCHAIN_ROOT="$(dirname "$SCRIPT_DIR")"
NODE_IP="${DEVNET_NODE_IP:-65.108.15.30}"
SSH_USER="${SSH_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_rsa_canton}"
REMOTE_BLOCKCHAIN="${1:-/root/canton-otc/blockchain}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
ok() { echo -e "${GREEN}✅ $1${NC}"; }
err() { echo -e "${RED}❌ $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

SSH_OPTS="-o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new"
[ -n "$SSH_KEY" ] && [ -f "$SSH_KEY" ] && SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
SSH_CMD="ssh $SSH_OPTS ${SSH_USER}@${NODE_IP}"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  DevNet: выполнение шагов на ноде $NODE_IP"
echo "  Путь на ноде: $REMOTE_BLOCKCHAIN"
echo "═══════════════════════════════════════════════════════════"
echo ""

info "Проверка SSH и наличия репо на ноде..."
if ! $SSH_CMD "test -d $REMOTE_BLOCKCHAIN && test -f $REMOTE_BLOCKCHAIN/scripts/get-onboarding-secret.sh"; then
  err "На ноде $NODE_IP в $REMOTE_BLOCKCHAIN нет репо/blockchain. Склонируйте или укажите путь: $0 /path/to/blockchain"
  echo "  Пример: rsync -avz -e \"ssh -i \$SSH_KEY\" $BLOCKCHAIN_ROOT/ ${SSH_USER}@${NODE_IP}:$(dirname $REMOTE_BLOCKCHAIN)/"
  exit 1
fi
ok "Репо на ноде есть"

info "Шаг 1/3 — получение DevNet onboarding secret (на ноде)..."
$SSH_CMD "cd $REMOTE_BLOCKCHAIN && ./scripts/get-onboarding-secret.sh devnet --save --force" || {
  err "Не удалось получить secret на ноде (проверьте egress IP 65.108.15.30)"
  exit 1
}
ok "Secret получен и сохранён на ноде"

info "Шаг 2/3 — обновление K8s secret (на ноде)..."
$SSH_CMD "cd $REMOTE_BLOCKCHAIN && ./scripts/update-onboarding-secret.sh devnet" || {
  err "Не удалось обновить K8s secret (проверьте kubectl на ноде)"
  exit 1
}
ok "K8s secret обновлён"

info "Шаг 3/3 — Helm deploy (на ноде)..."
$SSH_CMD "cd $REMOTE_BLOCKCHAIN && ./scripts/run-helm-devnet-deploy.sh" || {
  err "Helm deploy завершился с ошибкой"
  exit 1
}
ok "Деплой завершён"

echo ""
ok "Все шаги выполнены на ноде $NODE_IP. Проверка: $SSH_CMD 'kubectl get pods -n validator'"
echo "═══════════════════════════════════════════════════════════"
echo ""
