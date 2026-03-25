#!/usr/bin/env bash
# Deploy canton-otc-api to Canton DevNet.
# Usage:
#   ./deploy-devnet.sh           # apply manifests only
#   ./deploy-devnet.sh --build   # build Docker image first, then apply
#
# Required env vars (or set interactively):
#   CANTON_PARTY_ID          operator party (otc-operator::1220...)
#   CANTON_TRADER_PARTY_ID   trader party   (otc-trader1::1220...)  [optional]
#   CANTON_AUTH_TOKEN        JWT for Ledger API
#
# Optional:
#   CANTON_SYNCHRONIZER_ID   (default: global-domain::1220...)
#   KUBECONFIG               (default: system kubeconfig)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE="validator"
IMAGE="canton-otc-api:devnet"
PACKAGE_ID="66cfb6c5e8ef3e553a581460a0e2f24c1ffe93128f55d58e7f1bff756d976e53"
SYNCHRONIZER_ID="${CANTON_SYNCHRONIZER_ID:-global-domain::1220be58c29e65de40bf273be1dc2b266d43a9a002ea5b18955aeef7aac881bb471a}"

# ── Optional build ───────────────────────────────────────────────────────────
if [[ "${1:-}" == "--build" ]]; then
  echo "==> Building Docker image: $IMAGE"
  SDK_DIR="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)/../cantonnet-omnichain-sdk"
  docker build -f "$SDK_DIR/docker/Dockerfile.api-server" -t "$IMAGE" "$SDK_DIR"
  echo "==> Build complete"
fi

# ── Collect secrets ──────────────────────────────────────────────────────────
OPERATOR_PARTY="${CANTON_PARTY_ID:-}"
TRADER_PARTY="${CANTON_TRADER_PARTY_ID:-}"
AUTH_TOKEN="${CANTON_AUTH_TOKEN:-}"

if [[ -z "$OPERATOR_PARTY" ]]; then
  read -rp "CANTON_PARTY_ID (operator party): " OPERATOR_PARTY
fi
if [[ -z "$AUTH_TOKEN" ]]; then
  read -rp "CANTON_AUTH_TOKEN (JWT): " AUTH_TOKEN
fi

# ── Create/update secret ─────────────────────────────────────────────────────
echo "==> Updating secret: canton-otc-api-secrets"
kubectl create secret generic canton-otc-api-secrets \
  -n "$NAMESPACE" \
  --from-literal=operator-party-id="$OPERATOR_PARTY" \
  --from-literal=trader-party-id="$TRADER_PARTY" \
  --from-literal=synchronizer-id="$SYNCHRONIZER_ID" \
  --from-literal=package-id="$PACKAGE_ID" \
  --from-literal=auth-token="$AUTH_TOKEN" \
  --dry-run=client -o yaml \
  | kubectl apply -f -

# ── Apply manifests ──────────────────────────────────────────────────────────
echo "==> Applying manifests"
kubectl apply -f "$SCRIPT_DIR/deployment.yaml" -n "$NAMESPACE"
kubectl apply -f "$SCRIPT_DIR/service.yaml"    -n "$NAMESPACE"

# ── Wait for rollout ─────────────────────────────────────────────────────────
echo "==> Waiting for rollout..."
kubectl rollout status deployment/canton-otc-api -n "$NAMESPACE" --timeout=120s

# ── Health check ─────────────────────────────────────────────────────────────
NODE_IP="65.108.15.30"
API_URL="http://${NODE_IP}:30080"
echo "==> Health check: $API_URL/health"
sleep 3
curl -sf "$API_URL/health" | python3 -m json.tool \
  || echo "Health check failed — pod may still be starting, retry in a few seconds"

echo ""
echo "==> Done."
echo "    In-cluster:  http://canton-otc-api.validator.svc.cluster.local/health"
echo "    NodePort:    http://${NODE_IP}:30080/health"
echo ""
echo "==> Integration tests:"
echo "    INTEGRATION_TEST_BASE_URL=http://${NODE_IP}:30080 \\"
echo "    cargo test --package canton-otc-api --test integration_test -- --nocapture"
