#!/bin/bash

# Скрипт критического восстановления Kubernetes кластера
# Исправляет проблемы с cert-manager, ingress и Pending подами

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 КРИТИЧЕСКОЕ ВОССТАНОВЛЕНИЕ KUBERNETES КЛАСТЕРА${NC}"
echo ""

# Шаг 1: Остановить cert-manager
echo -e "${YELLOW}Шаг 1: Остановка cert-manager...${NC}"
kubectl scale deployment cert-manager -n cert-manager --replicas=0 2>/dev/null || echo "cert-manager уже остановлен"
kubectl scale deployment cert-manager-cainjector -n cert-manager --replicas=0 2>/dev/null || echo "cainjector уже остановлен"
kubectl scale deployment cert-manager-webhook -n cert-manager --replicas=0 2>/dev/null || echo "webhook уже остановлен"
echo -e "${GREEN}✅ Cert-manager остановлен${NC}"
echo ""

# Шаг 2: Удалить проблемные ingress (istio, nginx)
echo -e "${YELLOW}Шаг 2: Удаление проблемных ingress (istio, nginx)...${NC}"

# Удалить ingress с istio
echo "Удаление ingress с istio..."
kubectl get ingress -A -o json 2>/dev/null | \
  jq -r '.items[] | select(.spec.ingressClassName == "istio" or .metadata.annotations."kubernetes.io/ingress.class" == "istio") | "\(.metadata.namespace) \(.metadata.name)"' | \
  while read -r ns name; do
    if [ -n "$ns" ] && [ -n "$name" ]; then
      echo "  Удаление ingress $name в namespace $ns"
      kubectl delete ingress "$name" -n "$ns" --ignore-not-found=true 2>/dev/null || true
    fi
  done

# Удалить ingress с nginx
echo "Удаление ingress с nginx..."
kubectl get ingress -A -o json 2>/dev/null | \
  jq -r '.items[] | select(.spec.ingressClassName == "nginx" or .metadata.annotations."kubernetes.io/ingress.class" == "nginx") | "\(.metadata.namespace) \(.metadata.name)"' | \
  while read -r ns name; do
    if [ -n "$ns" ] && [ -n "$name" ]; then
      echo "  Удаление ingress $name в namespace $ns"
      kubectl delete ingress "$name" -n "$ns" --ignore-not-found=true 2>/dev/null || true
    fi
  done

echo -e "${GREEN}✅ Проблемные ingress удалены${NC}"
echo ""

# Шаг 3: Удалить проблемные Certificate ресурсы
echo -e "${YELLOW}Шаг 3: Удаление проблемных Certificate ресурсов...${NC}"

# Удалить Certificate для istio
echo "Удаление Certificate для istio..."
kubectl get certificate -A -o json 2>/dev/null | \
  jq -r '.items[] | select(.metadata.namespace == "istio-system" or (.metadata.name | contains("istio"))) | "\(.metadata.namespace) \(.metadata.name)"' | \
  while read -r ns name; do
    if [ -n "$ns" ] && [ -n "$name" ]; then
      echo "  Удаление certificate $name в namespace $ns"
      kubectl delete certificate "$name" -n "$ns" --ignore-not-found=true 2>/dev/null || true
    fi
  done

echo -e "${GREEN}✅ Проблемные Certificate удалены${NC}"
echo ""

# Шаг 4: Массовая очистка Pending подов
echo -e "${YELLOW}Шаг 4: Очистка Pending подов (cert-manager challenge)...${NC}"

PENDING_COUNT=$(kubectl get pods -A --field-selector status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
echo "Найдено Pending подов: $PENDING_COUNT"

if [ "$PENDING_COUNT" -gt 0 ]; then
  # Удалить cert-manager challenge поды
  echo "Удаление cert-manager challenge подов..."
  kubectl get pods -A --field-selector status.phase=Pending -o json 2>/dev/null | \
    jq -r '.items[] | select(.metadata.name | startswith("cm-acme-http-solver")) | "\(.metadata.namespace) \(.metadata.name)"' | \
    while read -r ns name; do
      if [ -n "$ns" ] && [ -n "$name" ]; then
        kubectl delete pod "$name" -n "$ns" --grace-period=0 --force --ignore-not-found=true 2>/dev/null || true
      fi
    done

  # Удалить старые Pending поды (старше 1 часа)
  echo "Удаление старых Pending подов (старше 1 часа)..."
  kubectl get pods -A --field-selector status.phase=Pending -o json 2>/dev/null | \
    jq -r '.items[] | select((.metadata.creationTimestamp | fromdateiso8601) < (now - 3600)) | "\(.metadata.namespace) \(.metadata.name)"' | \
    while read -r ns name; do
      if [ -n "$ns" ] && [ -n "$name" ]; then
        kubectl delete pod "$name" -n "$ns" --grace-period=0 --force --ignore-not-found=true 2>/dev/null || true
      fi
    done
fi

REMAINING_PENDING=$(kubectl get pods -A --field-selector status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
echo -e "${GREEN}✅ Осталось Pending подов: $REMAINING_PENDING${NC}"
echo ""

# Шаг 5: Очистить зависшие Challenge ресурсы
echo -e "${YELLOW}Шаг 5: Очистка зависших Challenge ресурсов...${NC}"

CHALLENGE_COUNT=$(kubectl get challenges -A --no-headers 2>/dev/null | wc -l | tr -d ' ')
echo "Найдено Challenge: $CHALLENGE_COUNT"

if [ "$CHALLENGE_COUNT" -gt 0 ]; then
  kubectl get challenges -A -o json 2>/dev/null | \
    jq -r '.items[] | select(.status.state == "pending" or .status.state == null) | "\(.metadata.namespace) \(.metadata.name)"' | \
    while read -r ns name; do
      if [ -n "$ns" ] && [ -n "$name" ]; then
        kubectl delete challenge "$name" -n "$ns" --ignore-not-found=true 2>/dev/null || true
      fi
    done
fi

echo -e "${GREEN}✅ Challenge ресурсы очищены${NC}"
echo ""

# Шаг 6: Очистить зависшие CertificateRequest и Order
echo -e "${YELLOW}Шаг 6: Очистка CertificateRequest и Order...${NC}"

# Удалить проблемные CertificateRequest
echo "Удаление проблемных CertificateRequest..."
kubectl get certificaterequests -A -o json 2>/dev/null | \
  jq -r '.items[] | select(.status.conditions == null or (.status.conditions[]?.status == "False" and .status.conditions[]?.reason == "Pending")) | "\(.metadata.namespace) \(.metadata.name)"' | \
  while read -r ns name; do
    if [ -n "$ns" ] && [ -n "$name" ]; then
      kubectl delete certificaterequest "$name" -n "$ns" --ignore-not-found=true 2>/dev/null || true
    fi
  done

# Удалить проблемные Order
echo "Удаление проблемных Order..."
kubectl get orders -A -o json 2>/dev/null | \
  jq -r '.items[] | select(.status.state == "pending" or .status.state == null) | "\(.metadata.namespace) \(.metadata.name)"' | \
  while read -r ns name; do
    if [ -n "$ns" ] && [ -n "$name" ]; then
      kubectl delete order "$name" -n "$ns" --ignore-not-found=true 2>/dev/null || true
    fi
  done

echo -e "${GREEN}✅ CertificateRequest и Order очищены${NC}"
echo ""

# Итоговая статистика
echo -e "${BLUE}📊 ИТОГОВАЯ СТАТИСТИКА:${NC}"
echo "Pending подов: $(kubectl get pods -A --field-selector status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')"
echo "Challenge подов: $(kubectl get pods -A | grep cm-acme-http-solver 2>/dev/null | wc -l | tr -d ' ')"
echo "Certificate ресурсов: $(kubectl get certificates -A --no-headers 2>/dev/null | wc -l | tr -d ' ')"
echo "Challenges: $(kubectl get challenges -A --no-headers 2>/dev/null | wc -l | tr -d ' ')"
echo ""

echo -e "${GREEN}✅ Критическое восстановление завершено!${NC}"
echo -e "${YELLOW}⚠️  Следующий шаг: исправить конфигурации проектов и перезапустить cert-manager${NC}"
