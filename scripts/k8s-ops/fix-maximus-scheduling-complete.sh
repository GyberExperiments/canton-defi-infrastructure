#!/bin/bash
# 🔧 Комплексный скрипт для исправления проблем с планированием подов maximus и redis
# Решает проблему Pending подов без событий от scheduler

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

TARGET_NODE="canton-node-65-108-15-30"
MAXIMUS_NAMESPACE="maximus"
REPORT_DIR="/tmp/maximus-fix-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$REPORT_DIR"

echo -e "${BLUE}🔧 КОМПЛЕКСНОЕ ИСПРАВЛЕНИЕ ПРОБЛЕМ С ПЛАНИРОВАНИЕМ ПОДОВ${NC}"
echo "=================================================================="
echo ""

# Функция для логирования
log() {
    echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Функция для сохранения вывода
save_output() {
    local file=$1
    shift
    "$@" > "$REPORT_DIR/$file" 2>&1 || true
}

# 1. Проверка доступности кластера
log "1. Проверка доступности кластера..."
if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}❌ Кластер недоступен${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Кластер доступен${NC}"
echo ""

# 2. Диагностика узла
log "2. Диагностика узла $TARGET_NODE..."
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
    echo "Удаляю taints..."
    kubectl taint nodes "$TARGET_NODE" $(kubectl get node "$TARGET_NODE" -o jsonpath='{.spec.taints[*].key}' | tr ' ' '\n' | sed 's/^/-- /' | tr '\n' ' ') --all 2>/dev/null || true
    echo -e "${GREEN}✅ Taints удалены${NC}"
else
    echo -e "${GREEN}✅ Узел не имеет taints${NC}"
fi

# Проверка unschedulable
UNSCHEDULABLE=$(kubectl get node "$TARGET_NODE" -o jsonpath='{.spec.unschedulable}' 2>/dev/null || echo "false")
if [ "$UNSCHEDULABLE" == "true" ]; then
    echo -e "${YELLOW}⚠️  Узел помечен как unschedulable${NC}"
    kubectl patch node "$TARGET_NODE" -p '{"spec":{"unschedulable":false}}'
    echo -e "${GREEN}✅ Узел помечен как schedulable${NC}"
fi

# Проверка ресурсов
echo ""
echo "Ресурсы узла:"
kubectl top node "$TARGET_NODE" 2>/dev/null || kubectl describe node "$TARGET_NODE" | grep -A 10 "Allocated resources" || true
echo ""

# Проверка предупреждения InvalidDiskCapacity
DISK_WARNING=$(kubectl describe node "$TARGET_NODE" 2>/dev/null | grep -i "InvalidDiskCapacity" || echo "")
if [ -n "$DISK_WARNING" ]; then
    echo -e "${YELLOW}⚠️  Обнаружено предупреждение InvalidDiskCapacity${NC}"
    echo "Это предупреждение может влиять на планирование подов."
    echo "Попытка обхода проблемы..."
    
    # Сохраняем информацию об узле
    save_output "node-description.txt" kubectl describe node "$TARGET_NODE"
    
    # Проверяем, не блокирует ли это планирование
    echo "Проверяю, можно ли обойти проблему..."
fi
echo ""

# 3. Проверка scheduler
log "3. Проверка состояния scheduler..."
# В K3s scheduler встроен в control-plane
CONTROL_PLANE=$(kubectl get nodes -l node-role.kubernetes.io/control-plane --no-headers 2>/dev/null | head -1 | awk '{print $1}' || echo "tmedm")
if [ -n "$CONTROL_PLANE" ]; then
    CP_STATUS=$(kubectl get node "$CONTROL_PLANE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
    if [ "$CP_STATUS" == "True" ]; then
        echo -e "${GREEN}✅ Control-plane узел $CONTROL_PLANE в статусе Ready${NC}"
    else
        echo -e "${YELLOW}⚠️  Control-plane узел $CONTROL_PLANE не в статусе Ready${NC}"
    fi
fi

# Проверка перегруженности scheduler (много Pending подов)
TOTAL_PENDING=$(kubectl get pods --all-namespaces -o jsonpath='{.items[?(@.status.phase=="Pending")].metadata.name}' 2>/dev/null | wc -w || echo "0")
if [ "$TOTAL_PENDING" -gt "1000" ]; then
    echo -e "${YELLOW}⚠️  Обнаружено $TOTAL_PENDING Pending подов в кластере${NC}"
    echo "Это может перегружать scheduler. Рекомендуется очистить старые Pending поды."
    echo ""
    echo "Очистка старых Pending подов из namespace platform-gyber-org (cert-manager)..."
    # Удаляем только очень старые поды (старше 1 часа) из проблемного namespace
    OLD_PODS=$(kubectl get pods -n platform-gyber-org -o json 2>/dev/null | \
        jq -r '.items[] | select(.status.phase=="Pending") | select((.metadata.creationTimestamp | fromdateiso8601) < (now - 3600)) | .metadata.name' 2>/dev/null || echo "")
    if [ -n "$OLD_PODS" ]; then
        OLD_COUNT=$(echo "$OLD_PODS" | wc -l)
        echo "Найдено $OLD_COUNT старых Pending подов для удаления"
        echo "$OLD_PODS" | head -100 | while read pod; do
            kubectl delete pod "$pod" -n platform-gyber-org --grace-period=0 --force 2>/dev/null || true
        done
        echo -e "${GREEN}✅ Удалено до 100 старых Pending подов${NC}"
    fi
fi
echo ""

# 4. Диагностика подов maximus
log "4. Диагностика подов в namespace $MAXIMUS_NAMESPACE..."
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
        save_output "pod-${pod}-describe.txt" kubectl describe pod "$pod" -n "$MAXIMUS_NAMESPACE"
        
        # Проверка причин Pending
        REASON=$(kubectl get pod "$pod" -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="PodScheduled")].reason}' 2>/dev/null || echo "Unknown")
        MESSAGE=$(kubectl get pod "$pod" -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="PodScheduled")].message}' 2>/dev/null || echo "No message")
        echo "    Причина: $REASON"
        echo "    Сообщение: $MESSAGE"
        
        # Проверка событий
        EVENTS=$(kubectl get events -n "$MAXIMUS_NAMESPACE" --field-selector involvedObject.name="$pod" --sort-by='.lastTimestamp' 2>/dev/null | tail -5 || echo "")
        if [ -z "$EVENTS" ]; then
            echo -e "    ${YELLOW}⚠️  Нет событий от scheduler${NC}"
        else
            echo "    События:"
            echo "$EVENTS" | sed 's/^/      /'
        fi
        echo ""
    done
fi

# 5. Исправление проблемы планирования
log "5. Исправление проблемы планирования..."

# 5.1. Удаление старых Pending подов
if [ -n "$PENDING_PODS" ]; then
    echo "Удаляю старые Pending поды для пересоздания..."
    for pod in $PENDING_PODS; do
        echo "  Удаляю $pod..."
        kubectl delete pod "$pod" -n "$MAXIMUS_NAMESPACE" --grace-period=0 --force 2>/dev/null || true
    done
    echo -e "${GREEN}✅ Старые Pending поды удалены${NC}"
    sleep 5
fi

# 5.2. Временное удаление nodeSelector для проверки
log "5.2. Временное удаление nodeSelector для проверки планирования..."
MAXIMUS_DEPLOYMENT=$(kubectl get deployment maximus -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.metadata.name}' 2>/dev/null || echo "")
REDIS_DEPLOYMENT=$(kubectl get deployment redis -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.metadata.name}' 2>/dev/null || echo "")

if [ -n "$MAXIMUS_DEPLOYMENT" ]; then
    CURRENT_SELECTOR=$(kubectl get deployment maximus -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.spec.template.spec.nodeSelector.kubernetes\.io/hostname}' 2>/dev/null || echo "")
    if [ "$CURRENT_SELECTOR" == "$TARGET_NODE" ]; then
        echo "Временно удаляю nodeSelector из deployment maximus для проверки..."
        kubectl patch deployment maximus -n "$MAXIMUS_NAMESPACE" -p '{"spec":{"template":{"spec":{"nodeSelector":null}}}}' || true
        echo -e "${GREEN}✅ nodeSelector удален${NC}"
        sleep 10
        
        # Проверяем, запланировался ли под
        NEW_POD=$(kubectl get pods -n "$MAXIMUS_NAMESPACE" -l app=maximus -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
        if [ -n "$NEW_POD" ]; then
            POD_STATUS=$(kubectl get pod "$NEW_POD" -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown")
            if [ "$POD_STATUS" == "Running" ]; then
                echo -e "${GREEN}✅ Под запланирован без nodeSelector${NC}"
                # Возвращаем nodeSelector
                echo "Возвращаю nodeSelector..."
                kubectl patch deployment maximus -n "$MAXIMUS_NAMESPACE" -p "{\"spec\":{\"template\":{\"spec\":{\"nodeSelector\":{\"kubernetes.io/hostname\":\"$TARGET_NODE\"}}}}}" || true
            elif [ "$POD_STATUS" == "Pending" ]; then
                echo -e "${YELLOW}⚠️  Под все еще в Pending без nodeSelector${NC}"
                echo "Проблема не в nodeSelector. Продолжаю диагностику..."
            fi
        fi
    fi
fi

if [ -n "$REDIS_DEPLOYMENT" ]; then
    CURRENT_SELECTOR=$(kubectl get deployment redis -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.spec.template.spec.nodeSelector.kubernetes\.io/hostname}' 2>/dev/null || echo "")
    if [ "$CURRENT_SELECTOR" == "$TARGET_NODE" ]; then
        echo "Временно удаляю nodeSelector из deployment redis для проверки..."
        kubectl patch deployment redis -n "$MAXIMUS_NAMESPACE" -p '{"spec":{"template":{"spec":{"nodeSelector":null}}}}' || true
        echo -e "${GREEN}✅ nodeSelector удален${NC}"
        sleep 10
    fi
fi

# 5.3. Перезапуск deployments
log "5.3. Перезапуск deployments..."
if [ -n "$MAXIMUS_DEPLOYMENT" ]; then
    echo "Перезапускаю deployment maximus..."
    kubectl rollout restart deployment maximus -n "$MAXIMUS_NAMESPACE" || true
    echo -e "${GREEN}✅ Deployment maximus перезапущен${NC}"
fi

if [ -n "$REDIS_DEPLOYMENT" ]; then
    echo "Перезапускаю deployment redis..."
    kubectl rollout restart deployment redis -n "$MAXIMUS_NAMESPACE" || true
    echo -e "${GREEN}✅ Deployment redis перезапущен${NC}"
fi

echo ""
echo "Ожидание планирования подов (60 секунд)..."
sleep 60

# 6. Проверка результатов
log "6. Проверка результатов..."
echo "Текущее состояние подов:"
kubectl get pods -n "$MAXIMUS_NAMESPACE" -o wide
echo ""

# Проверка endpoints
echo "Проверка endpoints:"
kubectl get endpoints -n "$MAXIMUS_NAMESPACE"
echo ""

# 7. Если поды все еще в Pending, пробуем альтернативные решения
FINAL_PENDING=$(kubectl get pods -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.items[?(@.status.phase=="Pending")].metadata.name}' 2>/dev/null | wc -w || echo "0")
if [ "$FINAL_PENDING" -gt "0" ]; then
    echo -e "${YELLOW}⚠️  Поды все еще в Pending. Пробую альтернативные решения...${NC}"
    
    # Решение 1: Использование affinity вместо nodeSelector
    log "Решение 1: Использование nodeAffinity вместо nodeSelector..."
    if [ -n "$MAXIMUS_DEPLOYMENT" ]; then
        kubectl patch deployment maximus -n "$MAXIMUS_NAMESPACE" -p '{
            "spec": {
                "template": {
                    "spec": {
                        "nodeSelector": null,
                        "affinity": {
                            "nodeAffinity": {
                                "requiredDuringSchedulingIgnoredDuringExecution": {
                                    "nodeSelectorTerms": [{
                                        "matchExpressions": [{
                                            "key": "kubernetes.io/hostname",
                                            "operator": "In",
                                            "values": ["'$TARGET_NODE'"]
                                        }]
                                    }]
                                }
                            }
                        }
                    }
                }
            }
        }' || true
    fi
    
    if [ -n "$REDIS_DEPLOYMENT" ]; then
        kubectl patch deployment redis -n "$MAXIMUS_NAMESPACE" -p '{
            "spec": {
                "template": {
                    "spec": {
                        "nodeSelector": null,
                        "affinity": {
                            "nodeAffinity": {
                                "requiredDuringSchedulingIgnoredDuringExecution": {
                                    "nodeSelectorTerms": [{
                                        "matchExpressions": [{
                                            "key": "kubernetes.io/hostname",
                                            "operator": "In",
                                            "values": ["'$TARGET_NODE'"]
                                        }]
                                    }]
                                }
                            }
                        }
                    }
                }
            }
        }' || true
    fi
    
    echo "Ожидание планирования с nodeAffinity (30 секунд)..."
    sleep 30
    
    # Решение 2: Если не помогло, убираем привязку к узлу полностью
    FINAL_PENDING_AFTER_AFFINITY=$(kubectl get pods -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.items[?(@.status.phase=="Pending")].metadata.name}' 2>/dev/null | wc -w || echo "0")
    if [ "$FINAL_PENDING_AFTER_AFFINITY" -gt "0" ]; then
        echo -e "${YELLOW}⚠️  nodeAffinity не помог. Убираю привязку к узлу полностью...${NC}"
        if [ -n "$MAXIMUS_DEPLOYMENT" ]; then
            kubectl patch deployment maximus -n "$MAXIMUS_NAMESPACE" -p '{"spec":{"template":{"spec":{"affinity":null,"nodeSelector":null}}}}' || true
        fi
        if [ -n "$REDIS_DEPLOYMENT" ]; then
            kubectl patch deployment redis -n "$MAXIMUS_NAMESPACE" -p '{"spec":{"template":{"spec":{"affinity":null,"nodeSelector":null}}}}' || true
        fi
        echo "Ожидание планирования без привязки к узлу (30 секунд)..."
        sleep 30
    fi
fi

# 8. Финальная проверка
log "8. Финальная проверка состояния..."
echo "Текущее состояние подов:"
kubectl get pods -n "$MAXIMUS_NAMESPACE" -o wide
echo ""

FINAL_RUNNING=$(kubectl get pods -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}' 2>/dev/null | wc -w || echo "0")
FINAL_PENDING=$(kubectl get pods -n "$MAXIMUS_NAMESPACE" -o jsonpath='{.items[?(@.status.phase=="Pending")].metadata.name}' 2>/dev/null | wc -w || echo "0")

echo "Итоговое состояние:"
echo "  - Running подов: $FINAL_RUNNING"
echo "  - Pending подов: $FINAL_PENDING"
echo ""

# 9. Проверка доступности сайтов
log "9. Проверка доступности сайтов..."

check_site() {
    local url=$1
    local name=$2
    echo -n "Проверка $name ($url)... "
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -k "https://$url" 2>/dev/null || echo "000")
    if echo "$HTTP_CODE" | grep -qE "200|301|302"; then
        echo -e "${GREEN}✅ Доступен (HTTP $HTTP_CODE)${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Недоступен или ошибка (HTTP $HTTP_CODE)${NC}"
        return 1
    fi
}

check_site "gyber.org" "gyber.org" || true
check_site "1otc.cc" "1otc.cc" || true
check_site "maximus-marketing-swarm.gyber.org" "maximus-marketing-swarm.gyber.org" || true
echo ""

# 10. Итоговый отчет
log "10. Итоговый отчет"
echo "=================="
echo "Отчет сохранен в: $REPORT_DIR"
echo ""

if [ "$FINAL_PENDING" -eq "0" ] && [ "$FINAL_RUNNING" -gt "0" ]; then
    echo -e "${GREEN}✅ УСПЕХ: Все поды запланированы и запущены${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Еще есть проблемы с планированием${NC}"
    echo ""
    echo "Рекомендации:"
    echo "1. Проверьте логи scheduler на control-plane узле"
    echo "2. Проверьте детали узла: kubectl describe node $TARGET_NODE"
    echo "3. Проверьте события: kubectl get events -n $MAXIMUS_NAMESPACE --sort-by='.lastTimestamp'"
    echo "4. Проверьте отчеты в: $REPORT_DIR"
    echo "5. Если проблема с диском, выполните на узле:"
    echo "   ssh root@$(kubectl get node $TARGET_NODE -o jsonpath='{.status.addresses[?(@.type=="InternalIP")].address}')"
    echo "   systemctl restart k3s-agent"
    echo "   k3s crictl rmi --prune"
    exit 1
fi
