#!/bin/bash

# Скрипт проверки статуса Canton Validator Node
# Проверяет подключение ноды, whitelisting и работу валидатора

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Конфигурация
NODE_IP="${NODE_IP:-65.108.15.30}"
NETWORK="${NETWORK:-testnet}"
MASTER_IP="${MASTER_IP:-31.129.105.180}"

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_header() {
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"
}

# Проверка подключения ноды к кластеру
check_node_in_cluster() {
    print_header "1. Проверка подключения ноды к кластеру"
    
    local node_found=false
    while IFS= read -r line; do
        if echo "$line" | grep -q "$NODE_IP"; then
            node_found=true
            print_status "Нода найдена в кластере:"
            echo "$line"
            break
        fi
    done < <(kubectl get nodes -o wide 2>/dev/null || echo "")
    
    if [ "$node_found" = false ]; then
        print_error "Нода $NODE_IP НЕ найдена в кластере"
        print_warning "Нода не подключена к k3s кластеру"
        echo ""
        echo "Для подключения выполните на сервере $NODE_IP:"
        echo "  ssh root@$NODE_IP"
        echo "  # Получите токен на master ноде:"
        echo "  # ssh root@$MASTER_IP 'sudo cat /var/lib/rancher/k3s/server/node-token'"
        echo "  # Затем выполните подключение к кластеру"
        return 1
    fi
    
    return 0
}

# Проверка развертывания валидатора
check_validator_deployment() {
    print_header "2. Проверка развертывания валидатора"
    
    local pod_name
    pod_name=$(kubectl get pods -n canton-node -l node=new-validator -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$pod_name" ]; then
        print_error "Валидатор НЕ развернут"
        print_warning "Нет пода с меткой node=new-validator"
        echo ""
        echo "Для развертывания выполните:"
        echo "  kubectl apply -f config/kubernetes/k8s/canton-validator-new-node.yaml"
        return 1
    fi
    
    print_status "Валидатор развернут: $pod_name"
    
    # Статус пода
    local pod_status
    pod_status=$(kubectl get pod -n canton-node "$pod_name" -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown")
    echo "  Статус: $pod_status"
    
    if [ "$pod_status" != "Running" ]; then
        print_warning "Под не в статусе Running"
        echo "  Проверьте логи: kubectl logs -n canton-node $pod_name"
    fi
    
    return 0
}

# Проверка endpoint сети
check_network_endpoint() {
    print_header "3. Проверка конфигурации сети"
    
    local current_endpoint
    current_endpoint=$(kubectl get pod -n canton-node -l node=new-validator -o jsonpath='{.spec.containers[0].env[?(@.name=="CANTON_API")].value}' 2>/dev/null || echo "")
    
    if [ -z "$current_endpoint" ]; then
        print_warning "Не удалось определить endpoint из пода"
        print_info "Проверяю манифест..."
        current_endpoint=$(grep -A 1 "CANTON_API" config/kubernetes/k8s/canton-validator-new-node.yaml 2>/dev/null | grep "value:" | sed 's/.*value: //' | tr -d '"' || echo "")
    fi
    
    if [ -n "$current_endpoint" ]; then
        echo "  Текущий endpoint: $current_endpoint"
        
        if echo "$current_endpoint" | grep -q "test"; then
            print_status "Настроен на TestNet"
        elif echo "$current_endpoint" | grep -q "dev"; then
            print_warning "Настроен на DevNet (не TestNet!)"
        elif echo "$current_endpoint" | grep -q "main"; then
            print_warning "Настроен на MainNet"
        fi
    else
        print_error "Не удалось определить endpoint"
    fi
}

# Проверка доступности ноды
check_node_accessibility() {
    print_header "4. Проверка доступности ноды"
    
    print_info "Проверка health endpoint: http://$NODE_IP:8081/health"
    
    local health_response
    health_response=$(curl -s --connect-timeout 5 --max-time 10 "http://$NODE_IP:8081/health" 2>&1 || echo "ERROR")
    
    if echo "$health_response" | grep -q "ERROR\|timeout\|refused"; then
        print_error "Health endpoint недоступен"
        echo "  Возможные причины:"
        echo "    - Нода не развернута"
        echo "    - Порт 8081 закрыт в firewall"
        echo "    - Валидатор не запущен"
        return 1
    else
        print_status "Health endpoint доступен"
        echo "  Ответ: $health_response"
    fi
    
    # Проверка metrics
    print_info "Проверка metrics endpoint: http://$NODE_IP:8080/metrics"
    local metrics_response
    metrics_response=$(curl -s --connect-timeout 5 --max-time 10 "http://$NODE_IP:8080/metrics" 2>&1 || echo "ERROR")
    
    if echo "$metrics_response" | grep -q "ERROR\|timeout\|refused"; then
        print_warning "Metrics endpoint недоступен"
    else
        print_status "Metrics endpoint доступен"
    fi
}

# Проверка whitelisting
check_whitelisting() {
    print_header "5. Проверка whitelisting"
    
    print_info "IP адрес: $NODE_IP"
    print_info "Сеть: $NETWORK"
    echo ""
    
    print_warning "Whitelisting можно проверить только через:"
    echo "  1. Логи валидатора (ошибки подключения)"
    echo "  2. Подтверждение от SV sponsor Canton Network"
    echo ""
    
    # Проверка логов на ошибки whitelisting
    local pod_name
    pod_name=$(kubectl get pods -n canton-node -l node=new-validator -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -n "$pod_name" ]; then
        print_info "Проверка логов на ошибки whitelisting..."
        local logs
        logs=$(kubectl logs -n canton-node "$pod_name" --tail=100 2>/dev/null || echo "")
        
        if echo "$logs" | grep -qi "whitelist\|unauthorized\|forbidden\|403\|401"; then
            print_error "Обнаружены ошибки, связанные с whitelisting!"
            echo "$logs" | grep -i "whitelist\|unauthorized\|forbidden\|403\|401" | head -5
        else
            print_status "В логах нет явных ошибок whitelisting"
        fi
    else
        print_warning "Не удалось проверить логи (под не найден)"
    fi
    
    echo ""
    print_info "Для подтверждения whitelisting:"
    echo "  1. Свяжитесь с SV sponsor Canton Network"
    echo "  2. Уточните статус whitelisting для IP $NODE_IP на $NETWORK"
    echo "  3. Проверьте логи валидатора после запуска"
}

# Проверка onboarding secret
check_onboarding_secret() {
    print_header "6. Проверка onboarding secret"
    
    local secret_exists
    secret_exists=$(kubectl get secret canton-onboarding -n canton-node 2>/dev/null && echo "yes" || echo "no")
    
    if [ "$secret_exists" = "no" ]; then
        print_error "Secret canton-onboarding не найден"
        echo ""
        echo "Для получения secret для $NETWORK выполните:"
        echo "  cd blockchain/scripts"
        echo "  ./get-onboarding-secret.sh $NETWORK --save"
        return 1
    fi
    
    print_status "Secret canton-onboarding существует"
    
    # Проверка ключа
    local has_key
    has_key=$(kubectl get secret canton-onboarding -n canton-node -o jsonpath='{.data.ONBOARDING_SECRET}' 2>/dev/null && echo "yes" || echo "no")
    
    if [ "$has_key" = "yes" ]; then
        print_status "Ключ ONBOARDING_SECRET присутствует"
    else
        print_error "Ключ ONBOARDING_SECRET отсутствует в secret"
    fi
}

# Главная функция
main() {
    echo ""
    print_header "🔍 Проверка статуса Canton Validator Node"
    echo ""
    print_info "IP ноды: $NODE_IP"
    print_info "Сеть: $NETWORK"
    print_info "Master IP: $MASTER_IP"
    echo ""
    
    local errors=0
    
    # Проверки
    check_node_in_cluster || ((errors++))
    echo ""
    
    check_validator_deployment || ((errors++))
    echo ""
    
    check_network_endpoint
    echo ""
    
    check_node_accessibility || ((errors++))
    echo ""
    
    check_whitelisting
    echo ""
    
    check_onboarding_secret || ((errors++))
    echo ""
    
    # Итог
    print_header "📊 Итоговый статус"
    
    if [ $errors -eq 0 ]; then
        print_status "Все проверки пройдены успешно!"
    else
        print_error "Обнаружено проблем: $errors"
        echo ""
        print_warning "Необходимо устранить проблемы перед запуском валидатора"
    fi
    
    echo ""
}

# Запуск
main "$@"


















