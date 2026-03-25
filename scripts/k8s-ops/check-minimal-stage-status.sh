#!/bin/bash

# 🔍 Canton OTC Minimal Stage Status Checker
# Проверяет статус всех компонентов minimal-stage окружения

set -e

NAMESPACE="canton-otc-minimal-stage"
APP_NAME="canton-otc"

echo "🔍 Проверяем статус Canton OTC в minimal-stage..."
echo "📋 Namespace: $NAMESPACE"
echo ""

# Проверяем namespace
echo "📦 Namespace Status:"
kubectl get namespace $NAMESPACE 2>/dev/null || echo "❌ Namespace не найден"
echo ""

# Проверяем pods
echo "🚀 Pods Status:"
kubectl get pods -n $NAMESPACE -l app=$APP_NAME 2>/dev/null || echo "❌ Pods не найдены"
echo ""

# Проверяем deployment
echo "📋 Deployment Status:"
kubectl get deployment $APP_NAME -n $NAMESPACE 2>/dev/null || echo "❌ Deployment не найден"
echo ""

# Проверяем service
echo "🌐 Service Status:"
kubectl get service $APP_NAME-service -n $NAMESPACE 2>/dev/null || echo "❌ Service не найден"
echo ""

# Проверяем Traefik IngressRoute (вместо стандартного Ingress)
echo "🚪 Traefik IngressRoute Status:"
kubectl get ingressroute -n $NAMESPACE 2>/dev/null || echo "❌ IngressRoute не найден"
echo ""

# Проверяем Certificate
echo "🔒 Certificate Status:"
kubectl get certificate -n $NAMESPACE 2>/dev/null || echo "❌ Certificate не найден"
echo ""

# Проверяем secrets
echo "🔐 Secrets Status:"
kubectl get secret -n $NAMESPACE 2>/dev/null || echo "❌ Secrets не найдены"
echo ""

# Проверяем логи последнего pod'а
echo "📝 Последние логи приложения:"
POD_NAME=$(kubectl get pods -n $NAMESPACE -l app=$APP_NAME -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
if [ -n "$POD_NAME" ]; then
    echo "Pod: $POD_NAME"
    kubectl logs $POD_NAME -n $NAMESPACE --tail=20 2>/dev/null || echo "❌ Не удалось получить логи"
else
    echo "❌ Pod не найден для получения логов"
fi
echo ""

# Проверяем ресурсы
echo "💾 Resource Usage:"
kubectl top pods -n $NAMESPACE 2>/dev/null || echo "❌ Metrics server не доступен"
echo ""

echo "✅ Проверка завершена!"
echo ""
echo "🌐 URL: https://stage.minimal.build.infra.1otc.cc"
echo "🔍 Health Check: https://stage.minimal.build.infra.1otc.cc/api/health"
echo "📊 Admin Panel: https://stage.minimal.build.infra.1otc.cc/admin"
