#!/bin/bash

# Скрипт для проверки уязвимости CVE-2025-55182 во всех проектах кластера
# Проверяет версии React, react-dom и Next.js в Kubernetes deployments

set -e

CVE="CVE-2025-55182"
VULNERABLE_REACT_VERSIONS="19.0.0 19.1.0 19.1.1 19.2.0"
VULNERABLE_NEXT_VERSIONS="15.0.0 15.1.0 15.1.1 15.1.2 15.1.3 15.1.4 15.1.5 15.1.6 15.1.7 15.1.8 15.2.0 15.2.1 15.2.2 15.2.3 15.2.4 15.2.5 15.3.0 15.3.1 15.3.2 15.3.3 15.3.4 15.3.5 15.4.0 15.4.1 15.4.2 15.4.3 15.4.4 15.4.5 15.4.6 15.4.7 15.5.0 15.5.1 15.5.2 15.5.3 15.5.4 15.5.5 15.5.6"

echo "🔒 Проверка уязвимости $CVE в кластере Kubernetes"
echo "================================================"
echo ""

VULNERABLE_COUNT=0
SAFE_COUNT=0
ERROR_COUNT=0

# Функция для проверки версии
check_version() {
    local version=$1
    local vulnerable_versions=$2
    local package_name=$3
    
    for vuln_version in $vulnerable_versions; do
        if [[ "$version" == "$vuln_version" ]] || [[ "$version" == "$vuln_version"* ]]; then
            echo "  ⚠️  $package_name: $version (УЯЗВИМА)"
            return 1
        fi
    done
    return 0
}

# Получаем все namespaces (исключаем системные)
NAMESPACES=$(kubectl get namespaces -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | grep -v -E "kube-|default|local")

for namespace in $NAMESPACES; do
    echo "📦 Namespace: $namespace"
    
    # Получаем все deployments в namespace
    DEPLOYMENTS=$(kubectl get deployments -n "$namespace" -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null || echo "")
    
    if [ -z "$DEPLOYMENTS" ]; then
        echo "  ℹ️  Нет deployments"
        echo ""
        continue
    fi
    
    for deployment in $DEPLOYMENTS; do
        echo "  🔍 Deployment: $deployment"
        
        # Проверяем, есть ли package.json в поде
        PACKAGE_JSON=$(kubectl exec -n "$namespace" deployment/"$deployment" -- \
            sh -c 'cat package.json 2>/dev/null' 2>/dev/null || echo "")
        
        if [ -z "$PACKAGE_JSON" ]; then
            echo "    ⚪ Не React/Next.js проект или недоступен"
            continue
        fi
        
        # Извлекаем версии
        REACT_VERSION=$(echo "$PACKAGE_JSON" | grep -oE '"react"\s*:\s*"[^"]*"' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "")
        REACT_DOM_VERSION=$(echo "$PACKAGE_JSON" | grep -oE '"react-dom"\s*:\s*"[^"]*"' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "")
        NEXT_VERSION=$(echo "$PACKAGE_JSON" | grep -oE '"next"\s*:\s*"[^"]*"' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "")
        
        if [ -z "$REACT_VERSION" ] && [ -z "$NEXT_VERSION" ]; then
            echo "    ⚪ Не React/Next.js проект"
            continue
        fi
        
        IS_VULNERABLE=0
        
        # Проверяем React
        if [ -n "$REACT_VERSION" ]; then
            if ! check_version "$REACT_VERSION" "$VULNERABLE_REACT_VERSIONS" "React"; then
                IS_VULNERABLE=1
            else
                echo "    ✅ React: $REACT_VERSION (безопасна)"
            fi
        fi
        
        # Проверяем react-dom
        if [ -n "$REACT_DOM_VERSION" ]; then
            if ! check_version "$REACT_DOM_VERSION" "$VULNERABLE_REACT_VERSIONS" "react-dom"; then
                IS_VULNERABLE=1
            else
                echo "    ✅ react-dom: $REACT_DOM_VERSION (безопасна)"
            fi
        fi
        
        # Проверяем Next.js
        if [ -n "$NEXT_VERSION" ]; then
            if ! check_version "$NEXT_VERSION" "$VULNERABLE_NEXT_VERSIONS" "Next.js"; then
                IS_VULNERABLE=1
            else
                echo "    ✅ Next.js: $NEXT_VERSION (безопасна)"
            fi
        fi
        
        if [ $IS_VULNERABLE -eq 1 ]; then
            echo "    🔴 СТАТУС: УЯЗВИМ"
            VULNERABLE_COUNT=$((VULNERABLE_COUNT + 1))
        else
            echo "    ✅ СТАТУС: Безопасен"
            SAFE_COUNT=$((SAFE_COUNT + 1))
        fi
    done
    echo ""
done

echo "================================================"
echo "📊 Итоговая статистика:"
echo "  ✅ Безопасных проектов: $SAFE_COUNT"
echo "  🔴 Уязвимых проектов: $VULNERABLE_COUNT"
echo "  ⚠️  Ошибок проверки: $ERROR_COUNT"
echo ""

if [ $VULNERABLE_COUNT -eq 0 ]; then
    echo "✅ Все проекты безопасны!"
    exit 0
else
    echo "🔴 Обнаружены уязвимые проекты! Требуется немедленное исправление."
    exit 1
fi

