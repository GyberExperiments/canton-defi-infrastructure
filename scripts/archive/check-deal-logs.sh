#!/bin/bash

# 🔍 Проверка логов системы принятия заявок
# Автор: AI Assistant

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 ПРОВЕРКА ЛОГОВ СИСТЕМЫ ПРИНЯТИЯ ЗАЯВОК${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Проверяем логи на наличие принятий заявок
echo -e "${YELLOW}📋 Ищу логи о принятии заявок...${NC}"
kubectl logs -n canton-otc deployment/canton-otc --tail=200 2>/dev/null | grep -E "Order accepted|Processing accept_order|Order found - Client Info" || echo "Логи о принятии не найдены"

echo ""
echo -e "${YELLOW}🔍 Ищу логи о проверке готовности сделок...${NC}"
kubectl logs -n canton-otc deployment/canton-otc --tail=200 2>/dev/null | grep -E "Checking for matching orders|Found matching order|deal readiness|Admin notified" || echo "Логи о готовности сделок не найдены"

echo ""
echo -e "${YELLOW}📊 Ищу логи с customerId...${NC}"
kubectl logs -n canton-otc deployment/canton-otc --tail=200 2>/dev/null | grep -E "customerId|customer_id" || echo "Логи с customerId не найдены"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}💡 Для просмотра всех логов:${NC}"
echo "   kubectl logs -n canton-otc deployment/canton-otc --tail=500 -f"
echo ""
