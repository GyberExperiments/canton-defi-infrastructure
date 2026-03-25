#!/bin/bash
# Комплексное исправление всех проблем после обновления версий проектов
# Исправляет: SSL сертификат 1OTC, Service для multi-swarm, RBAC для ConfigMap

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Параметры подключения
SSH_KEY="${SSH_KEY:-~/.ssh/id_rsa_canton}"
SSH_HOST="${SSH_HOST:-31.129.105.180}"
SSH_USER="${SSH_USER:-root}"

echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}   КОМПЛЕКСНОЕ ИСПРАВЛЕНИЕ ПРОБЛЕМ${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""

# Функция для выполнения команд на удалённом сервере
remote_exec() {
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "$@"
}

# Функция для применения YAML на удалённом сервере
apply_yaml() {
    local yaml_file="$1"
    local description="$2"
    
    echo -e "${YELLOW}📝 $description${NC}"
    if [ -f "$yaml_file" ]; then
        cat "$yaml_file" | remote_exec "kubectl apply -f -"
        echo -e "${GREEN}✅ Применено: $description${NC}"
    else
        echo -e "${RED}❌ Файл не найден: $yaml_file${NC}"
        return 1
    fi
    echo ""
}

# Получить путь к директории проекта
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
K8S_DIR="$PROJECT_ROOT/config/kubernetes/k8s"

echo -e "${YELLOW}📁 Директория проекта: $PROJECT_ROOT${NC}"
echo -e "${YELLOW}📁 K8s конфигурации: $K8S_DIR${NC}"
echo ""

# ============================================
# ШАГ 1: УСТАНОВКА CERT-MANAGER
# ============================================
echo -e "${GREEN}=== ШАГ 1: ПРОВЕРКА И УСТАНОВКА CERT-MANAGER ===${NC}"

# Проверить, установлен ли cert-manager
if remote_exec "kubectl get namespace cert-manager &>/dev/null"; then
    echo -e "${YELLOW}⚠️  Namespace cert-manager существует${NC}"
    
    # Проверить, работают ли поды
    PODS_READY=$(remote_exec "kubectl get pods -n cert-manager -l app.kubernetes.io/instance=cert-manager --no-headers 2>/dev/null | grep -c Running || echo 0")
    
    if [ "$PODS_READY" -gt 0 ]; then
        echo -e "${GREEN}✅ Cert-Manager уже установлен и работает ($PODS_READY pods)${NC}"
    else
        echo -e "${YELLOW}⚠️  Cert-Manager установлен, но поды не работают. Переустанавливаем...${NC}"
        remote_exec "kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.crds.yaml" || true
        remote_exec "kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.yaml" || true
        echo -e "${YELLOW}⏳ Ожидание готовности cert-manager (до 3 минут)...${NC}"
        remote_exec "kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=180s" || echo -e "${YELLOW}⚠️  Таймаут, но продолжаем${NC}"
    fi
else
    echo -e "${YELLOW}📦 Установка Cert-Manager...${NC}"
    remote_exec "kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.crds.yaml"
    remote_exec "kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.yaml"
    echo -e "${YELLOW}⏳ Ожидание готовности cert-manager (до 3 минут)...${NC}"
    remote_exec "kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=180s" || echo -e "${YELLOW}⚠️  Таймаут, но продолжаем${NC}"
fi
echo ""

# ============================================
# ШАГ 2: СОЗДАНИЕ CLUSTERISSUER
# ============================================
echo -e "${GREEN}=== ШАГ 2: СОЗДАНИЕ CLUSTERISSUER ===${NC}"

# Проверить, существует ли ClusterIssuer
if remote_exec "kubectl get clusterissuer letsencrypt-prod &>/dev/null"; then
    echo -e "${GREEN}✅ ClusterIssuer letsencrypt-prod уже существует${NC}"
else
    apply_yaml "$K8S_DIR/clusterissuer.yaml" "Создание ClusterIssuer для Let's Encrypt"
fi
echo ""

# ============================================
# ШАГ 3: СОЗДАНИЕ CERTIFICATE ДЛЯ 1OTC
# ============================================
echo -e "${GREEN}=== ШАГ 3: СОЗДАНИЕ CERTIFICATE ДЛЯ 1OTC ===${NC}"

# Проверить, существует ли Certificate
if remote_exec "kubectl get certificate canton-otc-tls -n canton-otc &>/dev/null"; then
    echo -e "${YELLOW}⚠️  Certificate уже существует. Обновляем...${NC}"
    apply_yaml "$K8S_DIR/certificate.yaml" "Обновление Certificate для 1OTC (все три домена)"
else
    apply_yaml "$K8S_DIR/certificate.yaml" "Создание Certificate для 1OTC (все три домена)"
fi

echo -e "${YELLOW}⏳ Ожидание выдачи сертификата (может занять 1-5 минут)...${NC}"
echo -e "${YELLOW}   Проверка статуса каждые 10 секунд (максимум 5 минут)...${NC}"

# Ждать готовности сертификата
for i in {1..30}; do
    CERT_STATUS=$(remote_exec "kubectl get certificate canton-otc-tls -n canton-otc -o jsonpath='{.status.conditions[?(@.type==\"Ready\")].status}' 2>/dev/null || echo ''")
    
    if [ "$CERT_STATUS" = "True" ]; then
        echo -e "${GREEN}✅ Сертификат готов!${NC}"
        break
    fi
    
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}⚠️  Таймаут ожидания сертификата. Проверьте статус вручную:${NC}"
        echo -e "${YELLOW}   kubectl get certificate -n canton-otc${NC}"
        echo -e "${YELLOW}   kubectl describe certificate canton-otc-tls -n canton-otc${NC}"
    else
        echo -e "${YELLOW}   Попытка $i/30... Статус: ${CERT_STATUS:-Pending}${NC}"
        sleep 10
    fi
done
echo ""

# ============================================
# ШАГ 4: СОЗДАНИЕ SERVICE ДЛЯ MULTI-SWARM
# ============================================
echo -e "${GREEN}=== ШАГ 4: СОЗДАНИЕ SERVICE ДЛЯ MULTI-SWARM ===${NC}"

# Проверить, существует ли Service
if remote_exec "kubectl get service multi-swarm-system-prod-service -n default &>/dev/null"; then
    echo -e "${GREEN}✅ Service multi-swarm-system-prod-service уже существует${NC}"
else
    apply_yaml "$K8S_DIR/multi-swarm-service.yaml" "Создание Service для multi-swarm-system"
    
    # Проверить endpoints
    echo -e "${YELLOW}🔍 Проверка endpoints...${NC}"
    remote_exec "kubectl get endpoints multi-swarm-system-prod-service -n default" || true
fi
echo ""

# ============================================
# ШАГ 5: ИСПРАВЛЕНИЕ ПРАВ CONFIGMAP ДЛЯ 1OTC
# ============================================
echo -e "${GREEN}=== ШАГ 5: ИСПРАВЛЕНИЕ ПРАВ CONFIGMAP ДЛЯ 1OTC ===${NC}"

# Проверить, применён ли RBAC
if remote_exec "kubectl get rolebinding canton-otc-configmap-editor-binding -n canton-otc &>/dev/null"; then
    echo -e "${GREEN}✅ RBAC конфигурация уже применена${NC}"
else
    apply_yaml "$K8S_DIR/configmap-rbac.yaml" "Применение RBAC для доступа к ConfigMap"
fi

# Проверить права доступа
echo -e "${YELLOW}🔍 Проверка прав доступа...${NC}"
CAN_GET=$(remote_exec "kubectl auth can-i get configmaps/canton-otc-config --as=system:serviceaccount:canton-otc:canton-otc-configmap-manager -n canton-otc 2>/dev/null || echo 'no'")

if [ "$CAN_GET" = "yes" ]; then
    echo -e "${GREEN}✅ Права на чтение ConfigMap: OK${NC}"
else
    echo -e "${RED}❌ Нет прав на чтение ConfigMap. Применяем RBAC...${NC}"
    apply_yaml "$K8S_DIR/configmap-rbac.yaml" "Повторное применение RBAC"
fi

# Перезапустить поды для применения прав
echo -e "${YELLOW}🔄 Перезапуск deployment для применения прав...${NC}"
remote_exec "kubectl rollout restart deployment/canton-otc -n canton-otc" || true
echo -e "${YELLOW}⏳ Ожидание готовности deployment...${NC}"
remote_exec "kubectl rollout status deployment/canton-otc -n canton-otc --timeout=5m" || echo -e "${YELLOW}⚠️  Таймаут, но deployment может быть готов${NC}"
echo ""

# ============================================
# ШАГ 6: ПРОВЕРКА РЕЗУЛЬТАТОВ
# ============================================
echo -e "${GREEN}=== ШАГ 6: ПРОВЕРКА РЕЗУЛЬТАТОВ ===${NC}"
echo ""

echo -e "${YELLOW}--- Certificate статус ---${NC}"
remote_exec "kubectl get certificate -n canton-otc" || true
echo ""

echo -e "${YELLOW}--- Multi-swarm Service ---${NC}"
remote_exec "kubectl get svc multi-swarm-system-prod-service -n default" || true
remote_exec "kubectl get endpoints multi-swarm-system-prod-service -n default" || true
echo ""

echo -e "${YELLOW}--- ConfigMap права ---${NC}"
remote_exec "kubectl auth can-i get configmaps/canton-otc-config --as=system:serviceaccount:canton-otc:canton-otc-configmap-manager -n canton-otc" || true
echo ""

echo -e "${YELLOW}--- Проверка SSL сертификата (Subject Alternative Name) ---${NC}"
CERT_SAN=$(remote_exec "kubectl get secret canton-otc-tls -n canton-otc -o jsonpath='{.data.tls\.crt}' 2>/dev/null | base64 -d | openssl x509 -noout -text 2>/dev/null | grep -A3 'Subject Alternative Name' || echo 'Сертификат ещё не готов или не найден'")
echo "$CERT_SAN"
echo ""

echo -e "${YELLOW}--- Проверка HTTP/HTTPS доступности ---${NC}"
for site in '1otc.cc' 'multi-swarm-system.gyber.org'; do
    HTTP_CODE=$(remote_exec "curl -sk -H 'Host: $site' -o /dev/null -w '%{http_code}' https://127.0.0.1 -m 3 2>/dev/null || echo '000'")
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ $site: HTTP $HTTP_CODE${NC}"
    else
        echo -e "${YELLOW}⚠️  $site: HTTP $HTTP_CODE${NC}"
    fi
done
echo ""

echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}   ИСПРАВЛЕНИЕ ЗАВЕРШЕНО${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "${YELLOW}⚠️  ВАЖНО:${NC}"
echo -e "${YELLOW}1. Certificate может занять 1-5 минут для выдачи${NC}"
echo -e "${YELLOW}2. Проверьте статус: kubectl get certificate -n canton-otc${NC}"
echo -e "${YELLOW}3. Проверьте доступность https://1otc.cc в браузере${NC}"
echo -e "${YELLOW}4. Проверьте логи: kubectl logs -n canton-otc -l app=canton-otc --tail=20${NC}"
echo ""
