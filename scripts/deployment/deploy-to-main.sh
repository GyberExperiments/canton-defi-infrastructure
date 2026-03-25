#!/bin/bash
# Скрипт для деплоя Canton OTC в main контур через kubectl
# Использовать после успешного локального build

set -e

echo "🚀 Deploying Canton OTC to main (production)..."
echo ""

# Проверка что образ существует
echo "📦 Checking if image exists..."
if ! docker images | grep -q "ghcr.io/themacroeconomicdao/cantonotc.*main"; then
  echo "❌ Image not found! Build it first:"
  echo "   docker build -t ghcr.io/themacroeconomicdao/cantonotc:main -f Dockerfile ."
  exit 1
fi
echo "✅ Image found"
echo ""

# Логин в GHCR
echo "🔐 Logging into GitHub Container Registry..."
echo "$GITHUB_TOKEN" | docker login ghcr.io -u TheMacroeconomicDao --password-stdin
echo ""

# Push образа
echo "📤 Pushing image to registry..."
docker push ghcr.io/themacroeconomicdao/cantonotc:main
docker push ghcr.io/themacroeconomicdao/cantonotc:4259f057
echo ""

# Деплой через kubectl
echo "🎯 Deploying to Kubernetes..."
kubectl set image deployment/canton-otc canton-otc=ghcr.io/themacroeconomicdao/cantonotc:main -n canton-otc
echo ""

# Перезапуск деплоймента
echo "🔄 Restarting deployment..."
kubectl rollout restart deployment/canton-otc -n canton-otc
echo ""

# Ожидание завершения rollout
echo "⏳ Waiting for rollout to complete..."
kubectl rollout status deployment/canton-otc -n canton-otc --timeout=300s
echo ""

# Проверка статуса
echo "✅ Deployment completed! Checking status..."
kubectl get pods -n canton-otc -l app=canton-otc
echo ""

# Проверка образа
echo "📦 Current image:"
kubectl get deployment canton-otc -n canton-otc -o jsonpath='{.spec.template.spec.containers[0].image}'
echo ""
echo ""

echo "🎉 Deployment successful!"
echo ""
echo "🧪 Test with curl:"
echo 'curl -X POST https://1otc.cc/api/create-order \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{"cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95...", "refundAddress": "bron::1220da95...", "usdtAmount": 700, "cantonAmount": 1591, "email": "test@example.com"}'"'"
echo ""

