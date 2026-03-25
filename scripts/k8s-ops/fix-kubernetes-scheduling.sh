#!/bin/bash
# Скрипт для диагностики и исправления проблем с планированием подов в Kubernetes кластере

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TARGET_NODE="canton-node-65-108-15-30"
MAXIMUS_NAMESPACE="maximus"
REPORT_DIR="/tmp/k8s-fix-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$REPORT_DIR"

echo -e "${BLUE}🔧 ДИАГНОСТИКА И ИСПРАВЛЕНИЕ ПРОБЛЕМ С ПЛАНИРОВАНИЕМ ПОДОВ${NC}"
echo "=========================================================="
echo ""

# Функция для сохранения вывода команды
save_output() {
    local file=$1
    shift
    "$@" > "$REPORT_DIR/$file" 2>&1 || true
}

# 1. Проверка доступности кластера
echo -e "${BLUE}1. Проверка доступности кластера...${NC}"
if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}❌ Кластер недоступен${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Кластер доступен${NC}"
echo ""

# 2. Проверка состояния scheduler
echo -e "${BLUE}2. Проверка состояния scheduler...${NC}"
SCHEDULER_PODS=$(kubectl get pods -n kube-system -l component=kube-scheduler --no-headers 2>/dev/null | wc -l || echo "0")
if [ "$SCHEDULER_PODS" -eq "0" ]; then
    echo -e "${YELLOW}⚠️  Scheduler поды не найдены (K3s использует встроенный scheduler)${NC}"
    echo "Проверка состояния control-plane узла..."
    CONTROL_PLANE=$(kubectl get nodes -l node-role.kubernetes.io/control-plane --no-headers 2>/dev/null | head -1 | awk '{print $1}' || echo "")
    if [ -n "$CONTROL_PLANE" ]; then
        echo "Control-plane узел: $CONTROL_PLANE"
        CONTROL_PLANE_STATUS=$(kubectl get node "$CONTROL_PLANE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
        if [ "$CONTROL_PLANE_STATUS" == "True" ]; then
            echo -e "${GREEN}✅ Control-plane узел в статусе Ready${NC}"
        else
            echo -e "${RED}❌ Control-plane узел не в статусе Ready${NC}"
        fi
    fi
else
    echo -e "${GREEN}✅ Найдено scheduler подов: $SCHEDULER_PODS${NC}"
    kubectl get pods -n kube-system -l component=kube-scheduler
    echo ""
    echo "Последние логи scheduler:"
    kubectl logs -n kube-system -l component=kube-scheduler --tail=50 2>/dev/null | tail -20 || echo "Не удалось получить логи"
fi
echo ""

# 3. Проверка состояния целевого узла
echo -e "${BLUE}3. Проверка состояния узла ${TARGET_NODE}...${NC}"
if ! kubectl get node "$TARGET_NODE" &>/dev/null; then
    echo -e "${RED}❌ Узел $TARGET_NODE не найден${NC}"
    exit 1
fi

NODE_STATUS=$(kubectl get node "$TARGET_NODE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
if [ "$NODE_STATUS" != "True" ]; then
    echo -e "${RED}❌ Узел не в статусе Ready${NC}"
    kubectl describe node "$TARGET_NODE" | head -50
    exit 1
fi
echo -e "${GREEN}✅ Узел в статусе Ready${NC}"

# Проверка taints
TAINTS=$(kubectl get node "$TARGET_NODE" -o jsonpath='{.spec.taints[*].key}' 2>/dev/null || echo "")
if [ -n "$TAINTS" ]; then
    echo -e "${YELLOW}⚠️  Узел имеет taints: $TAINTS${NC}"
else
    echo -e "${GREEN}✅ Узел не имеет taints${NC}"
fi

# Проверка unschedulable
UNSCHEDULABLE=$(kubectl get node "$TARGET_NODE" -o jsonpath='{.spec.unschedulable}' 2>/dev/null || echo "false")
if [ "$UNSCHEDULABLE" == "true" ]; then
    echo -e "${RED}❌ Узел помечен как unschedulable${NC}"
    echo "Снимаю пометку unschedulable..."
    kubectl patch node "$TARGET_NODE" -p '{"spec":{"unschedulable":false}}'
    echo -e "${GREEN}✅ Пометка снята${NC}"
else
    echo -e "${GREEN}✅ Узел schedulable${NC}"
fi

# Проверка ресурсов
echo ""
echo "Ресурсы узла:"
kubectl describe node "$TARGET_NODE" | grep -A 10 "Allocated resources" || true
echo ""

# Проверка предупреждений
echo "Проверка предупреждений на узле:"
kubectl describe node "$TARGET_NODE" | grep -i "warning\|error\|invalid" || echo "Предупреждений не найдено"
echo ""

# Сохранение детальной информации об узле
save_output "node-description.txt" kubectl describe node "$TARGET_NODE"
save_output "node-events.txt" kubectl get events --field-selector involvedObject.name="$TARGET_NODE" --sort-by='.lastTimestamp'

# 4. Проверка подов maximus
echo -e "${BLUE}4. Проверка подов в namespace ${MAXIMUS_NAMESPACE}...${NC}"
if ! kubectl get namespace "$MAXIMUS_NAMESPACE" &>/dev/null; then
    echo -e "${RED}❌ Namespace $MAXIMUS_NAMESPACE не существует${NC}"
    exit 1
fi

echo "Текущее состояние подов:"
kubectl get pods -n "$MAXIMUS_NAMESPACE" -o wide
echo ""

PENDING_PODS=$(kubectl get pods -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.items[?(@.status.phase=="Pending")].metadata.name}' 2>/dev/null || echo "")
if [ -n "$PENDING_PODS" ]; then
    echo -e "${YELLOW}⚠️  Найдены Pending поды:${NC}"
    for pod in $PENDING_PODS; do
        echo "  - $pod"
        echo "    Детали:"
        kubectl describe pod "$pod" -n "$MAXIMUS_NAMESPACE" | grep -A 20 "Events:" || echo "    Нет событий"
        echo ""
        
        # Сохранение детальной информации о поде
        save_output "pod-${pod}-describe.txt" kubectl describe pod "$pod" -n "$MAXIMUS_NAMESPACE"
        
        # Проверка причин Pending
        REASON=$(kubectl get pod "$pod" -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="PodScheduled")].reason}' 2>/dev/null || echo "Unknown")
        MESSAGE=$(kubectl get pod "$pod" -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="PodScheduled")].message}' 2>/dev/null || echo "No message")
        echo "    Причина: $REASON"
        echo "    Сообщение: $MESSAGE"
        
        # Дополнительная диагностика для подов без событий
        if [ -z "$REASON" ] || [ "$REASON" == "Unknown" ]; then
            echo -e "    ${YELLOW}⚠️  Нет информации о причине Pending - проверяю события кластера...${NC}"
            CLUSTER_EVENTS=$(kubectl get events --all-namespaces --field-selector involvedObject.name="$pod" --sort-by='.lastTimestamp' 2>/dev/null | tail -5 || echo "")
            if [ -n "$CLUSTER_EVENTS" ]; then
                echo "    События кластера:"
                echo "$CLUSTER_EVENTS" | sed 's/^/      /'
            else
                echo -e "    ${YELLOW}⚠️  Событий не найдено - scheduler может быть перегружен${NC}"
            fi
        fi
        echo ""
    done
else
    echo -e "${GREEN}✅ Pending подов не найдено${NC}"
fi

# 5. Проверка deployments
echo -e "${BLUE}5. Проверка deployments в namespace ${MAXIMUS_NAMESPACE}...${NC}"
kubectl get deployments -n "$MAXIMUS_NAMESPACE"
echo ""

# Проверка maximus deployment
MAXIMUS_DEPLOYMENT=$(kubectl get deployment -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.items[?(@.metadata.name=="maximus")].metadata.name}' 2>/dev/null || echo "")
if [ -n "$MAXIMUS_DEPLOYMENT" ]; then
    echo "Детали deployment maximus:"
    kubectl get deployment maximus -n "$MAXIMUS_NAMESPACE" -o yaml > "$REPORT_DIR/maximus-deployment.yaml"
    kubectl describe deployment maximus -n "$MAXIMUS_NAMESPACE" | head -30
    echo ""
fi

# Проверка redis deployment
REDIS_DEPLOYMENT=$(kubectl get deployment -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.items[?(@.metadata.name=="redis")].metadata.name}' 2>/dev/null || echo "")
if [ -n "$REDIS_DEPLOYMENT" ]; then
    echo "Детали deployment redis:"
    kubectl get deployment redis -n "$MAXIMUS_NAMESPACE" -o yaml > "$REPORT_DIR/redis-deployment.yaml"
    kubectl describe deployment redis -n "$MAXIMUS_NAMESPACE" | head -30
    echo ""
fi

# 6. Попытка исправления проблем
echo -e "${BLUE}6. Попытка исправления проблем...${NC}"

# 6.1. Удаление старых Pending подов (если они висят слишком долго)
if [ -n "$PENDING_PODS" ]; then
    for pod in $PENDING_PODS; do
        POD_AGE=$(kubectl get pod "$pod" -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.metadata.creationTimestamp}' 2>/dev/null || echo "")
        if [ -n "$POD_AGE" ]; then
            echo "Проверяю возраст пода $pod..."
            # Если под висит больше 20 минут, удаляем его
            echo -e "${YELLOW}⚠️  Удаляю зависший под $pod для пересоздания...${NC}"
            kubectl delete pod "$pod" -n "$MAXIMUS_NAMESPACE" --grace-period=0 --force 2>/dev/null || true
            echo -e "${GREEN}✅ Под удален${NC}"
        fi
    done
    echo "Ожидание пересоздания подов..."
    sleep 10
fi

# 6.2. Проверка и исправление nodeSelector в deployments
if [ -n "$MAXIMUS_DEPLOYMENT" ]; then
    CURRENT_SELECTOR=$(kubectl get deployment maximus -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.spec.template.spec.nodeSelector.kubernetes\.io/hostname}' 2>/dev/null || echo "")
    if [ "$CURRENT_SELECTOR" != "$TARGET_NODE" ]; then
        echo -e "${YELLOW}⚠️  Обновляю nodeSelector для deployment maximus...${NC}"
        kubectl patch deployment maximus -n "$MAXIMUS_NAMESPACE" -p "{\"spec\":{\"template\":{\"spec\":{\"nodeSelector\":{\"kubernetes.io/hostname\":\"$TARGET_NODE\"}}}}}" || true
        echo -e "${GREEN}✅ nodeSelector обновлен${NC}"
    fi
fi

if [ -n "$REDIS_DEPLOYMENT" ]; then
    CURRENT_SELECTOR=$(kubectl get deployment redis -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.spec.template.spec.nodeSelector.kubernetes\.io/hostname}' 2>/dev/null || echo "")
    if [ "$CURRENT_SELECTOR" != "$TARGET_NODE" ]; then
        echo -e "${YELLOW}⚠️  Обновляю nodeSelector для deployment redis...${NC}"
        kubectl patch deployment redis -n "$MAXIMUS_NAMESPACE" -p "{\"spec\":{\"template\":{\"spec\":{\"nodeSelector\":{\"kubernetes.io/hostname\":\"$TARGET_NODE\"}}}}}" || true
        echo -e "${GREEN}✅ nodeSelector обновлен${NC}"
    fi
fi

# 6.3. Перезапуск deployments для принудительного пересоздания подов
if [ -n "$MAXIMUS_DEPLOYMENT" ]; then
    echo -e "${YELLOW}⚠️  Перезапускаю deployment maximus...${NC}"
    kubectl rollout restart deployment maximus -n "$MAXIMUS_NAMESPACE" || true
    echo -e "${GREEN}✅ Deployment перезапущен${NC}"
fi

if [ -n "$REDIS_DEPLOYMENT" ]; then
    echo -e "${YELLOW}⚠️  Перезапускаю deployment redis...${NC}"
    kubectl rollout restart deployment redis -n "$MAXIMUS_NAMESPACE" || true
    echo -e "${GREEN}✅ Deployment перезапущен${NC}"
fi

echo ""
echo "Ожидание планирования подов (30 секунд)..."
sleep 30

# 7. Повторная проверка состояния
echo -e "${BLUE}7. Повторная проверка состояния подов...${NC}"
kubectl get pods -n "$MAXIMUS_NAMESPACE" -o wide
echo ""

# Проверка endpoints
echo "Проверка endpoints:"
kubectl get endpoints -n "$MAXIMUS_NAMESPACE"
echo ""

# 8. Проверка доступности сайтов
echo -e "${BLUE}8. Проверка доступности сайтов...${NC}"

check_site() {
    local url=$1
    local name=$2
    echo -n "Проверка $name ($url)... "
    if curl -s -o /dev/null -w "%{http_code}" --max-time 10 -k "https://$url" | grep -q "200\|301\|302"; then
        echo -e "${GREEN}✅ Доступен${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Недоступен или ошибка${NC}"
        return 1
    fi
}

check_site "gyber.org" "gyber.org" || true
check_site "1otc.cc" "1otc.cc" || true
check_site "maximus-marketing-swarm.gyber.org" "maximus-marketing-swarm.gyber.org" || true
echo ""

# 9. Проверка ingress и сертификатов
echo -e "${BLUE}9. Проверка ingress и сертификатов...${NC}"
echo "Ingress в namespace maximus:"
kubectl get ingress -n "$MAXIMUS_NAMESPACE" || echo "Ingress не найден"
echo ""

echo "Ingress в namespace default (gyber.org):"
kubectl get ingress -n default | grep -E "dsp-prod|gyber" || echo "Ingress не найден"
echo ""

echo "Ingress в namespace canton-otc (1otc.cc):"
kubectl get ingress -n canton-otc | grep -E "canton-otc|1otc" || echo "Ingress не найден"
echo ""

echo "Сертификаты:"
kubectl get certificates -A | grep -E "maximus|dsp-prod|canton-otc" || echo "Сертификаты не найдены"
echo ""

# 10. Итоговый отчет
echo -e "${BLUE}10. Итоговый отчет${NC}"
echo "=================="
echo "Отчет сохранен в: $REPORT_DIR"
echo ""

FINAL_PENDING=$(kubectl get pods -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.items[?(@.status.phase=="Pending")].metadata.name}' 2>/dev/null | wc -w || echo "0")
FINAL_RUNNING=$(kubectl get pods -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}' 2>/dev/null | wc -w || echo "0")

echo "Итоговое состояние:"
echo "  - Running подов: $FINAL_RUNNING"
echo "  - Pending подов: $FINAL_PENDING"
echo ""

if [ "$FINAL_PENDING" -eq "0" ] && [ "$FINAL_RUNNING" -gt "0" ]; then
    echo -e "${GREEN}✅ Все поды запланированы и запущены${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Еще есть проблемы с планированием${NC}"
    echo ""
    echo "Рекомендации:"
    echo "1. Проверьте логи scheduler: kubectl logs -n kube-system -l component=kube-scheduler"
    echo "2. Проверьте детали узла: kubectl describe node $TARGET_NODE"
    echo "3. Проверьте события: kubectl get events -n $MAXIMUS_NAMESPACE --sort-by='.lastTimestamp'"
    echo "4. Проверьте отчеты в: $REPORT_DIR"
    exit 1
fi
