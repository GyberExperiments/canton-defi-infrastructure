#!/bin/bash

# Скрипт для исправления ingress конфигураций в проектах экосистемы
# Заменяет nginx/istio на traefik

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ECOSYSTEM_DIR="/Users/Gyber/GYBERNATY-ECOSYSTEM"

echo -e "${BLUE}🔧 ИСПРАВЛЕНИЕ INGRESS КОНФИГУРАЦИЙ${NC}"
echo ""

# Функция для исправления ingress файла
fix_ingress_file() {
  local file="$1"
  local changed=false

  if [ ! -f "$file" ]; then
    return 0
  fi

  echo -e "${YELLOW}Проверка файла: $file${NC}"

  # Проверить, нужно ли исправление
  if grep -q "ingressClassName: nginx" "$file" || \
     grep -q "ingressClassName: istio" "$file" || \
     grep -q 'kubernetes.io/ingress.class: "nginx"' "$file" || \
     grep -q 'kubernetes.io/ingress.class: "istio"' "$file"; then
    echo "  Найдены проблемы, исправление..."

    # Создать backup
    cp "$file" "${file}.backup"

    # Заменить nginx на traefik
    if grep -q "ingressClassName: nginx" "$file"; then
      sed -i '' 's/ingressClassName: nginx/ingressClassName: traefik/g' "$file"
      changed=true
    fi

    if grep -q "ingressClassName: istio" "$file"; then
      sed -i '' 's/ingressClassName: istio/ingressClassName: traefik/g' "$file"
      changed=true
    fi

    # Заменить аннотации nginx на traefik
    if grep -q 'kubernetes.io/ingress.class: "nginx"' "$file"; then
      sed -i '' 's/kubernetes.io\/ingress.class: "nginx"/traefik.ingress.kubernetes.io\/router.entrypoints: websecure/g' "$file"
      changed=true
    fi

    if grep -q 'kubernetes.io/ingress.class: "istio"' "$file"; then
      sed -i '' 's/kubernetes.io\/ingress.class: "istio"/traefik.ingress.kubernetes.io\/router.entrypoints: websecure/g' "$file"
      changed=true
    fi

    # Удалить nginx аннотации
    sed -i '' '/nginx.ingress.kubernetes.io/d' "$file"

    if [ "$changed" = true ]; then
      echo -e "  ${GREEN}✅ Файл исправлен${NC}"
    fi
  else
    echo "  Файл в порядке"
  fi
}

# Найти и исправить все ingress файлы
echo -e "${YELLOW}Поиск ingress файлов...${NC}"

find "$ECOSYSTEM_DIR" -type f \( -name "*ingress*.yaml" -o -name "*ingress*.yml" \) ! -name "*.backup" | while read -r file; do
  fix_ingress_file "$file"
done

echo ""
echo -e "${GREEN}✅ Исправление ingress конфигураций завершено!${NC}"
echo -e "${YELLOW}⚠️  Проверьте изменения перед применением в кластер${NC}"
