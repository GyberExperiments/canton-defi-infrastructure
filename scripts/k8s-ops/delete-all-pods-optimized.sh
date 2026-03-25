#!/bin/bash
# Оптимизированное массовое удаление всех подов (современные best practices)
# Поддерживает удаление тысяч подов за секунды

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

NAMESPACE="${1:-platform-gyber-org}"
PHASE_FILTER="${2:-}"  # Опционально: Pending, Running, Failed и т.д.
PARALLEL_JOBS="${PARALLEL_JOBS:-50}"  # Количество параллельных процессов
BATCH_SIZE="${BATCH_SIZE:-500}"  # Размер батча для обработки

echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  МАССОВОЕ УДАЛЕНИЕ ПОДОВ (ОПТИМИЗИРОВАННЫЙ МЕТОД)   ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Проверка доступности кластера
if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}❌ Кластер недоступен${NC}"
    exit 1
fi

# Определяем селектор
SELECTOR_CMD="kubectl get pods -n $NAMESPACE"
if [ -n "$PHASE_FILTER" ]; then
    SELECTOR_CMD="$SELECTOR_CMD --field-selector=status.phase=$PHASE_FILTER"
    echo -e "${BLUE}Фильтр: только поды в статусе '$PHASE_FILTER'${NC}"
else
    echo -e "${BLUE}Удаление всех подов в namespace '$NAMESPACE'${NC}"
fi

# Получаем начальное количество подов
echo -e "${BLUE}Получение списка подов...${NC}"
INITIAL_COUNT=$($SELECTOR_CMD --no-headers 2>/dev/null | wc -l | tr -d ' ' || echo "0")

if [ "$INITIAL_COUNT" -eq "0" ]; then
    echo -e "${GREEN}✅ Подов не найдено${NC}"
    exit 0
fi

echo -e "${YELLOW}Найдено подов: $INITIAL_COUNT${NC}"
echo -e "${BLUE}Параллельных процессов: $PARALLEL_JOBS${NC}"
echo -e "${BLUE}Размер батча: $BATCH_SIZE${NC}"
echo ""

# МЕТОД 1: Попытка массового удаления через kubectl delete --all (самый быстрый)
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}МЕТОД 1: Массовое удаление через kubectl delete --all${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

DELETE_CMD="kubectl delete pods -n $NAMESPACE --all"
if [ -n "$PHASE_FILTER" ]; then
    DELETE_CMD="$DELETE_CMD --field-selector=status.phase=$PHASE_FILTER"
fi

# Выполняем удаление с оптимальными параметрами
timeout 120 $DELETE_CMD \
    --grace-period=0 \
    --force \
    --wait=false \
    2>&1 | head -50 || true

sleep 2

# Проверяем результат
REMAINING_COUNT=$($SELECTOR_CMD --no-headers 2>/dev/null | wc -l | tr -d ' ' || echo "0")
DELETED_IN_BATCH=$((INITIAL_COUNT - REMAINING_COUNT))

echo ""
echo -e "${GREEN}Удалено методом 1: $DELETED_IN_BATCH подов${NC}"
echo -e "${BLUE}Осталось: $REMAINING_COUNT подов${NC}"
echo ""

# МЕТОД 2: Если остались поды, используем параллельное удаление через xargs
if [ "$REMAINING_COUNT" -gt "0" ]; then
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}МЕТОД 2: Параллельное удаление через xargs${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    TOTAL_DELETED_METHOD2=0
    ITERATION=1
    MAX_ITERATIONS=10
    
    while [ "$REMAINING_COUNT" -gt "0" ] && [ "$ITERATION" -le "$MAX_ITERATIONS" ]; do
        echo -e "${BLUE}Итерация $ITERATION/$MAX_ITERATIONS (осталось: $REMAINING_COUNT подов)...${NC}"
        
        # Получаем список подов и удаляем параллельно
        $SELECTOR_CMD -o jsonpath='{.items[*].metadata.name}' 2>/dev/null | \
            tr ' ' '\n' | \
            grep -v '^$' | \
            head -"$BATCH_SIZE" | \
            xargs -r -P "$PARALLEL_JOBS" -I {} sh -c "
                kubectl delete pod {} -n $NAMESPACE \
                    --grace-period=0 \
                    --force \
                    --wait=false \
                    2>&1 | grep -q 'deleted\|not found' && echo 'OK' || true
            " 2>/dev/null | wc -l | xargs -I {} echo {} > /tmp/deleted_count_$$ || echo "0" > /tmp/deleted_count_$$
        
        DELETED_THIS_ITERATION=$(cat /tmp/deleted_count_$$ 2>/dev/null || echo "0")
        TOTAL_DELETED_METHOD2=$((TOTAL_DELETED_METHOD2 + DELETED_THIS_ITERATION))
        
        sleep 1
        
        # Обновляем счетчик оставшихся подов
        OLD_REMAINING=$REMAINING_COUNT
        REMAINING_COUNT=$($SELECTOR_CMD --no-headers 2>/dev/null | wc -l | tr -d ' ' || echo "0")
        
        echo -e "${GREEN}  → Удалено в этой итерации: ~$DELETED_THIS_ITERATION${NC}"
        echo -e "${BLUE}  → Осталось: $REMAINING_COUNT${NC}"
        echo ""
        
        # Если количество не изменилось, возможно поды создаются заново
        if [ "$REMAINING_COUNT" -eq "$OLD_REMAINING" ] && [ "$REMAINING_COUNT" -gt "0" ]; then
            echo -e "${YELLOW}⚠️  Количество не изменилось. Возможно, поды создаются заново${NC}"
            break
        fi
        
        # Если осталось мало подов, выходим
        if [ "$REMAINING_COUNT" -lt "10" ]; then
            break
        fi
        
        ITERATION=$((ITERATION + 1))
    done
    
    rm -f /tmp/deleted_count_$$
    
    echo -e "${GREEN}Удалено методом 2: ~$TOTAL_DELETED_METHOD2 подов${NC}"
    echo ""
fi

# МЕТОД 3: Финальная очистка оставшихся подов (если их немного)
FINAL_COUNT=$($SELECTOR_CMD --no-headers 2>/dev/null | wc -l | tr -d ' ' || echo "0")

if [ "$FINAL_COUNT" -gt "0" ] && [ "$FINAL_COUNT" -lt "100" ]; then
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}МЕТОД 3: Финальная очистка оставшихся подов${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    $SELECTOR_CMD -o jsonpath='{.items[*].metadata.name}' 2>/dev/null | \
        tr ' ' '\n' | \
        grep -v '^$' | \
        xargs -r -P 20 -I {} kubectl delete pod {} -n "$NAMESPACE" \
            --grace-period=0 \
            --force \
            --wait=false \
            2>&1 | grep -q 'deleted\|not found' || true
    
    sleep 1
    FINAL_COUNT=$($SELECTOR_CMD --no-headers 2>/dev/null | wc -l | tr -d ' ' || echo "0")
fi

# Итоговый результат
TOTAL_DELETED=$((INITIAL_COUNT - FINAL_COUNT))

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    ИТОГОВЫЙ РЕЗУЛЬТАТ                 ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo -e "Было подов:        ${YELLOW}$INITIAL_COUNT${NC}"
echo -e "Удалено подов:     ${GREEN}$TOTAL_DELETED${NC}"
echo -e "Осталось подов:    ${YELLOW}$FINAL_COUNT${NC}"
echo ""

if [ "$FINAL_COUNT" -eq "0" ]; then
    echo -e "${GREEN}✅ Все поды успешно удалены!${NC}"
    exit 0
elif [ "$FINAL_COUNT" -lt "$INITIAL_COUNT" ]; then
    PERCENTAGE=$((TOTAL_DELETED * 100 / INITIAL_COUNT))
    echo -e "${GREEN}✅ Удалено $PERCENTAGE% подов ($TOTAL_DELETED из $INITIAL_COUNT)${NC}"
    if [ "$FINAL_COUNT" -gt "0" ]; then
        echo -e "${YELLOW}⚠️  Осталось $FINAL_COUNT подов${NC}"
        echo -e "${YELLOW}   Возможно, они создаются заново контроллерами${NC}"
        echo -e "${BLUE}   Рекомендуется проверить Deployments, ReplicaSets, StatefulSets${NC}"
    fi
    exit 0
else
    echo -e "${RED}❌ Удаление не удалось. Возможно, поды создаются заново${NC}"
    echo -e "${YELLOW}   Проверьте контроллеры (Deployments, ReplicaSets, StatefulSets)${NC}"
    exit 1
fi
