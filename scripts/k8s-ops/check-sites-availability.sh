#!/bin/bash
# Скрипт для проверки доступности сайтов и их конфигураций

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🌐 ПРОВЕРКА ДОСТУПНОСТИ САЙТОВ${NC}"
echo "=================================="
echo ""

# Функция для проверки сайта
check_site() {
    local url=$1
    local name=$2
    local namespace=$3
    
    echo -e "${BLUE}Проверка: $name${NC}"
    echo "  URL: https://$url"
    
    # Проверка HTTP статуса
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -k "https://$url" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "301" ] || [ "$HTTP_CODE" == "302" ]; then
        echo -e "  HTTP статус: ${GREEN}$HTTP_CODE ✅${NC}"
    else
        echo -e "  HTTP статус: ${RED}$HTTP_CODE ❌${NC}"
    fi
    
    # Проверка редиректа с HTTP на HTTPS
    REDIRECT=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -L "http://$url" 2>/dev/null || echo "000")
    if [ "$REDIRECT" == "200" ] || [ "$REDIRECT" == "301" ] || [ "$REDIRECT" == "302" ]; then
        echo -e "  HTTP → HTTPS редирект: ${GREEN}Работает ✅${NC}"
    else
        echo -e "  HTTP → HTTPS редирект: ${YELLOW}Не работает ⚠️${NC}"
    fi
    
    # Проверка сертификата
    CERT_INFO=$(echo | openssl s_client -servername "$url" -connect "$url:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
    if [ -n "$CERT_INFO" ]; then
        CERT_VALID=$(echo "$CERT_INFO" | grep "notAfter" | cut -d= -f2)
        echo -e "  Сертификат действителен до: ${GREEN}$CERT_VALID ✅${NC}"
    else
        echo -e "  Сертификат: ${YELLOW}Не удалось проверить ⚠️${NC}"
    fi
    
    # Проверка ingress
    echo "  Проверка Ingress в namespace $namespace:"
    INGRESS=$(kubectl get ingress -n "$namespace" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$INGRESS" ]; then
        for ing in $INGRESS; do
            HOSTS=$(kubectl get ingress "$ing" -n "$namespace" -o jsonpath='{.spec.rules[*].host}' 2>/dev/null || echo "")
            if echo "$HOSTS" | grep -q "$url"; then
                echo -e "    ${GREEN}✅ Ingress $ing настроен для $url${NC}"
            fi
        done
    else
        echo -e "    ${YELLOW}⚠️  Ingress не найден${NC}"
    fi
    
    # Проверка endpoints
    echo "  Проверка Endpoints:"
    ENDPOINTS=$(kubectl get endpoints -n "$namespace" -o jsonpath='{.items[*].subsets[*].addresses[*].ip}' 2>/dev/null || echo "")
    if [ -n "$ENDPOINTS" ]; then
        echo -e "    ${GREEN}✅ Endpoints найдены: $ENDPOINTS${NC}"
    else
        echo -e "    ${RED}❌ Endpoints не найдены${NC}"
    fi
    
    # Проверка подов
    echo "  Проверка подов:"
    RUNNING_PODS=$(kubectl get pods -n "$namespace" -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}' 2>/dev/null | wc -w || echo "0")
    PENDING_PODS=$(kubectl get pods -n "$namespace" -o jsonpath='{.items[?(@.status.phase=="Pending")].metadata.name}' 2>/dev/null | wc -w || echo "0")
    if [ "$RUNNING_PODS" -gt "0" ]; then
        echo -e "    ${GREEN}✅ Running подов: $RUNNING_PODS${NC}"
    fi
    if [ "$PENDING_PODS" -gt "0" ]; then
        echo -e "    ${YELLOW}⚠️  Pending подов: $PENDING_PODS${NC}"
    fi
    if [ "$RUNNING_PODS" -eq "0" ] && [ "$PENDING_PODS" -eq "0" ]; then
        echo -e "    ${RED}❌ Поды не найдены${NC}"
    fi
    
    echo ""
}

# Проверка gyber.org
check_site "gyber.org" "gyber.org" "default"

# Проверка 1otc.cc
check_site "1otc.cc" "1otc.cc" "canton-otc"

# Проверка maximus-marketing-swarm.gyber.org
check_site "maximus-marketing-swarm.gyber.org" "maximus-marketing-swarm.gyber.org" "maximus"

echo -e "${BLUE}Итоговый отчет:${NC}"
echo "=================="
echo "Проверка завершена. Смотрите результаты выше."
echo ""
