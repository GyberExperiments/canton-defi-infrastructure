#!/bin/bash
# Комплексный скрипт для исправления всех проблем с Kubernetes кластером

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}🚀 КОМПЛЕКСНОЕ ИСПРАВЛЕНИЕ KUBERNETES КЛАСТЕРА${NC}"
echo "=============================================="
echo ""

# Проверка доступности кластера
if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}❌ Кластер недоступен${NC}"
    exit 1
fi

# Шаг 1: Исправление проблемы с планированием подов
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}ШАГ 1: Исправление планирования подов${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""
"$SCRIPT_DIR/fix-kubernetes-scheduling.sh" || true
SCHEDULING_EXIT=$?

if [ $SCHEDULING_EXIT -eq 0 ]; then
    echo -e "${GREEN}✅ Планирование подов исправлено${NC}"
else
    echo -e "${YELLOW}⚠️  Есть проблемы с планированием подов${NC}"
fi
echo ""

# Шаг 2: Исправление проблемы InvalidDiskCapacity
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}ШАГ 2: Исправление InvalidDiskCapacity${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""
"$SCRIPT_DIR/fix-node-disk-capacity.sh" || true
DISK_EXIT=$?

if [ $DISK_EXIT -eq 0 ]; then
    echo -e "${GREEN}✅ Проблема InvalidDiskCapacity обработана${NC}"
else
    echo -e "${YELLOW}⚠️  Требуется ручное вмешательство для InvalidDiskCapacity${NC}"
fi
echo ""

# Шаг 3: Проверка доступности сайтов
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}ШАГ 3: Проверка доступности сайтов${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""
"$SCRIPT_DIR/check-sites-availability.sh" || true
SITES_EXIT=$?

if [ $SITES_EXIT -eq 0 ]; then
    echo -e "${GREEN}✅ Проверка сайтов завершена${NC}"
else
    echo -e "${YELLOW}⚠️  Есть проблемы с доступностью сайтов${NC}"
fi
echo ""

# Итоговый отчет
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}ИТОГОВЫЙ ОТЧЕТ${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

if [ $SCHEDULING_EXIT -eq 0 ] && [ $DISK_EXIT -eq 0 ] && [ $SITES_EXIT -eq 0 ]; then
    echo -e "${GREEN}✅ Все проверки пройдены успешно${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Есть проблемы, требующие внимания:${NC}"
    [ $SCHEDULING_EXIT -ne 0 ] && echo "  - Проблемы с планированием подов"
    [ $DISK_EXIT -ne 0 ] && echo "  - Проблема InvalidDiskCapacity (может потребоваться ручное исправление)"
    [ $SITES_EXIT -ne 0 ] && echo "  - Проблемы с доступностью сайтов"
    echo ""
    echo "Проверьте логи и отчеты для детальной информации."
    exit 1
fi
