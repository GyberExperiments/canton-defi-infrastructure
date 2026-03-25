#!/bin/bash
# 🌐 Комплексная проверка доступности всех трех сайтов

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}🌐 ПРОВЕРКА ДОСТУПНОСТИ ВСЕХ САЙТОВ${NC}"
echo "======================================"
echo ""

# Функция для проверки сайта
check_site_comprehensive() {
    local url=$1
    local name=$2
    local namespace=$3
    
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Проверка: $name${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "  URL: https://$url"
    echo ""
    
    local all_ok=true
    
    # 1. Проверка HTTP статуса (HTTPS)
    echo -n "  [1/6] HTTPS доступность... "
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -k "https://$url" 2>/dev/null || echo "000")
    if echo "$HTTP_CODE" | grep -qE "200|301|302"; then
        echo -e "${GREEN}✅ HTTP $HTTP_CODE${NC}"
    else
        echo -e "${RED}❌ HTTP $HTTP_CODE${NC}"
        all_ok=false
    fi
    
    # 2. Проверка редиректа с HTTP на HTTPS
    echo -n "  [2/6] HTTP → HTTPS редирект... "
    REDIRECT_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -L "http://$url" 2>/dev/null || echo "000")
    if echo "$REDIRECT_CODE" | grep -qE "200|301|302"; then
        echo -e "${GREEN}✅ Работает (HTTP $REDIRECT_CODE)${NC}"
    else
        echo -e "${YELLOW}⚠️  Не работает (HTTP $REDIRECT_CODE)${NC}"
    fi
    
    # 3. Проверка сертификата
    echo -n "  [3/6] SSL сертификат... "
    CERT_INFO=$(echo | timeout 5 openssl s_client -servername "$url" -connect "$url:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
    if [ -n "$CERT_INFO" ]; then
        CERT_VALID=$(echo "$CERT_INFO" | grep "notAfter" | cut -d= -f2)
        CERT_VALID_EPOCH=$(date -d "$CERT_VALID" +%s 2>/dev/null || echo "0")
        NOW_EPOCH=$(date +%s)
        if [ "$CERT_VALID_EPOCH" -gt "$NOW_EPOCH" ]; then
            DAYS_LEFT=$(( ($CERT_VALID_EPOCH - $NOW_EPOCH) / 86400 ))
            echo -e "${GREEN}✅ Действителен до $CERT_VALID (осталось ~$DAYS_LEFT дней)${NC}"
        else
            echo -e "${RED}❌ Истек${NC}"
            all_ok=false
        fi
    else
        echo -e "${YELLOW}⚠️  Не удалось проверить${NC}"
    fi
    
    # 4. Проверка Ingress
    echo -n "  [4/6] Ingress конфигурация... "
    INGRESS=$(kubectl get ingress -n "$namespace" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$INGRESS" ]; then
        FOUND=false
        for ing in $INGRESS; do
            HOSTS=$(kubectl get ingress "$ing" -n "$namespace" -o jsonpath='{.spec.rules[*].host}' 2>/dev/null || echo "")
            if echo "$HOSTS" | grep -q "$url"; then
                FOUND=true
                INGRESS_IP=$(kubectl get ingress "$ing" -n "$namespace" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
                if [ -n "$INGRESS_IP" ]; then
                    echo -e "${GREEN}✅ $ing (IP: $INGRESS_IP)${NC}"
                else
                    echo -e "${GREEN}✅ $ing${NC}"
                fi
                break
            fi
        done
        if [ "$FOUND" == "false" ]; then
            echo -e "${YELLOW}⚠️  Ingress найден, но не для $url${NC}"
        fi
    else
        echo -e "${RED}❌ Ingress не найден${NC}"
        all_ok=false
    fi
    
    # 5. Проверка Endpoints
    echo -n "  [5/6] Endpoints... "
    ENDPOINTS=$(kubectl get endpoints -n "$namespace" -o jsonpath='{.items[*].subsets[*].addresses[*].ip}' 2>/dev/null || echo "")
    if [ -n "$ENDPOINTS" ]; then
        ENDPOINT_COUNT=$(echo "$ENDPOINTS" | tr ' ' '\n' | grep -v '^$' | wc -l)
        echo -e "${GREEN}✅ Найдено $ENDPOINT_COUNT endpoint(s): $ENDPOINTS${NC}"
    else
        echo -e "${RED}❌ Endpoints не найдены${NC}"
        all_ok=false
    fi
    
    # 6. Проверка подов
    echo -n "  [6/6] Состояние подов... "
    RUNNING_PODS=$(kubectl get pods -n "$namespace" -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}' 2>/dev/null | wc -w || echo "0")
    PENDING_PODS=$(kubectl get pods -n "$namespace" -o jsonpath='{.items[?(@.status.phase=="Pending")].metadata.name}' 2>/dev/null | wc -w || echo "0")
    CRASH_PODS=$(kubectl get pods -n "$namespace" -o jsonpath='{.items[?(@.status.phase=="Failed")].metadata.name}' 2>/dev/null | wc -w || echo "0")
    
    if [ "$RUNNING_PODS" -gt "0" ] && [ "$PENDING_PODS" -eq "0" ] && [ "$CRASH_PODS" -eq "0" ]; then
        echo -e "${GREEN}✅ Running: $RUNNING_PODS, Pending: $PENDING_PODS, Failed: $CRASH_PODS${NC}"
    elif [ "$RUNNING_PODS" -gt "0" ]; then
        echo -e "${YELLOW}⚠️  Running: $RUNNING_PODS, Pending: $PENDING_PODS, Failed: $CRASH_PODS${NC}"
    else
        echo -e "${RED}❌ Running: $RUNNING_PODS, Pending: $PENDING_PODS, Failed: $CRASH_PODS${NC}"
        all_ok=false
    fi
    
    echo ""
    
    if [ "$all_ok" == "true" ]; then
        echo -e "${GREEN}✅ $name: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ${NC}"
    else
        echo -e "${YELLOW}⚠️  $name: ЕСТЬ ПРОБЛЕМЫ${NC}"
    fi
    echo ""
}

# Проверка gyber.org
check_site_comprehensive "gyber.org" "gyber.org" "default"

# Проверка 1otc.cc
check_site_comprehensive "1otc.cc" "1otc.cc" "canton-otc"

# Проверка maximus-marketing-swarm.gyber.org
check_site_comprehensive "maximus-marketing-swarm.gyber.org" "maximus-marketing-swarm.gyber.org" "maximus"

# Итоговый отчет
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}ИТОГОВЫЙ ОТЧЕТ${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Проверка завершена. Смотрите результаты выше."
echo ""
echo "Для детальной диагностики проблем используйте:"
echo "  ./scripts/fix-maximus-scheduling-complete.sh"
echo "  ./scripts/diagnose-cluster.sh"
echo ""
