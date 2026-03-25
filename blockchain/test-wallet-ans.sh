#!/bin/bash
# Скрипт для полного тестирования Wallet и ANS UI через curl

set -euo pipefail

BASE_URL="${BASE_URL:-http://65.108.15.30}"
TIMEOUT="${TIMEOUT:-5}"

echo "🧪 ТЕСТИРОВАНИЕ WALLET И ANS UI"
echo "================================"
echo "Base URL: $BASE_URL"
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Счетчики
PASSED=0
FAILED=0
WARNINGS=0

# Функция для проверки статуса
check_status() {
  local url=$1
  local expected=${2:-200}
  local name=${3:-$url}
  
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "000")
  
  if [ "$status" = "$expected" ]; then
    echo -e "${GREEN}✅${NC} $name: $status"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌${NC} $name: $status (expected $expected)"
    ((FAILED++))
    return 1
  fi
}

# Функция для проверки Content-Type
check_content_type() {
  local url=$1
  local expected_type=$2
  local name=${3:-$url}
  
  local content_type
  content_type=$(curl -s -I "$url" 2>/dev/null | grep -i "content-type" | cut -d' ' -f2 | tr -d '\r' || echo "")
  
  if echo "$content_type" | grep -qi "$expected_type"; then
    echo -e "${GREEN}✅${NC} $name: $content_type"
    ((PASSED++))
    return 0
  else
    echo -e "${YELLOW}⚠️${NC}  $name: $content_type (expected $expected_type)"
    ((WARNINGS++))
    return 1
  fi
}

# 1. Основные endpoints
echo "1️⃣  Основные endpoints:"
check_status "$BASE_URL/health" 200 "Health check"
check_status "$BASE_URL/wallet/" 200 "Wallet UI"
check_status "$BASE_URL/ans/" 200 "ANS UI"
check_status "$BASE_URL/" 301 "Root redirect"
echo ""

# 2. Статические файлы - статус
echo "2️⃣  Статические файлы (статус):"
check_status "$BASE_URL/config.js" 200 "config.js"
check_status "$BASE_URL/assets/index-t66-VGVm.js" 200 "Wallet JS"
check_status "$BASE_URL/assets/index-ZrfCEqT9.js" 200 "ANS JS"
check_status "$BASE_URL/assets/index-C52KiyAZ.css" 200 "CSS"
echo ""

# 3. Статические файлы - Content-Type
echo "3️⃣  Статические файлы (Content-Type):"
check_content_type "$BASE_URL/config.js" "javascript" "config.js"
check_content_type "$BASE_URL/assets/index-t66-VGVm.js" "javascript" "Wallet JS"
check_content_type "$BASE_URL/assets/index-ZrfCEqT9.js" "javascript" "ANS JS"
check_content_type "$BASE_URL/assets/index-C52KiyAZ.css" "css" "CSS"
echo ""

# 4. Проверка config.js
echo "4️⃣  Проверка config.js:"
CONFIG=$(curl -s --max-time "$TIMEOUT" "$BASE_URL/config.js" 2>/dev/null || echo "")

if [ -z "$CONFIG" ]; then
  echo -e "${RED}❌${NC} Не удалось загрузить config.js"
  ((FAILED++))
else
  echo -e "${GREEN}✅${NC} config.js загружен"
  ((PASSED++))
  
  # Проверка на пустые обязательные поля
  if echo "$CONFIG" | grep -q 'authority: ""'; then
    echo -e "${RED}❌${NC} ERROR: auth.authority is empty (вызывает ошибку валидации)"
    ((FAILED++))
  else
    echo -e "${GREEN}✅${NC} auth.authority is set"
    ((PASSED++))
  fi
  
  if echo "$CONFIG" | grep -q 'networkFaviconUrl: ""'; then
    echo -e "${YELLOW}⚠️${NC}  WARN: networkFaviconUrl is empty (может вызвать ошибку валидации)"
    ((WARNINGS++))
  else
    echo -e "${GREEN}✅${NC} networkFaviconUrl is set"
    ((PASSED++))
  fi
  
  # Показать содержимое
  echo ""
  echo "   Содержимое config.js:"
  echo "$CONFIG" | grep -E 'authority|networkFaviconUrl|networkName|validator' | sed 's/^/   /'
fi
echo ""

# 5. Проверка HTML страниц
echo "5️⃣  Проверка HTML страниц:"
WALLET_HTML=$(curl -s --max-time "$TIMEOUT" "$BASE_URL/wallet/" 2>/dev/null || echo "")
ANS_HTML=$(curl -s --max-time "$TIMEOUT" "$BASE_URL/ans/" 2>/dev/null || echo "")

if [ -z "$WALLET_HTML" ]; then
  echo -e "${RED}❌${NC} Не удалось загрузить Wallet HTML"
  ((FAILED++))
else
  echo -e "${GREEN}✅${NC} Wallet HTML загружен"
  ((PASSED++))
  
  # Проверка на наличие скриптов
  if echo "$WALLET_HTML" | grep -q '<script'; then
    echo -e "${GREEN}✅${NC} Wallet HTML содержит скрипты"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠️${NC}  Wallet HTML не содержит скрипты"
    ((WARNINGS++))
  fi
fi

if [ -z "$ANS_HTML" ]; then
  echo -e "${RED}❌${NC} Не удалось загрузить ANS HTML"
  ((FAILED++))
else
  echo -e "${GREEN}✅${NC} ANS HTML загружен"
  ((PASSED++))
  
  # Проверка на наличие скриптов
  if echo "$ANS_HTML" | grep -q '<script'; then
    echo -e "${GREEN}✅${NC} ANS HTML содержит скрипты"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠️${NC}  ANS HTML не содержит скрипты"
    ((WARNINGS++))
  fi
fi
echo ""

# 6. Проверка OIDC Discovery endpoint
echo "6️⃣  Проверка OIDC Discovery endpoint:"
OIDC_DISCOVERY=$(curl -s --max-time "$TIMEOUT" "$BASE_URL/.well-known/openid-configuration" 2>/dev/null || echo "")

if [ -z "$OIDC_DISCOVERY" ]; then
  echo -e "${RED}❌${NC} Не удалось загрузить OIDC discovery"
  ((FAILED++))
else
  echo -e "${GREEN}✅${NC} OIDC discovery загружен"
  ((PASSED++))
  
  # Проверка, что порты заменены на 80
  if echo "$OIDC_DISCOVERY" | grep -q ':32232'; then
    echo -e "${RED}❌${NC} ERROR: Discovery содержит порт 32232 (должен быть заменен на 80)"
    ((FAILED++))
  else
    echo -e "${GREEN}✅${NC} Порт 32232 заменен на 80"
    ((PASSED++))
  fi
  
  if echo "$OIDC_DISCOVERY" | grep -q ':32233'; then
    echo -e "${RED}❌${NC} ERROR: Discovery содержит порт 32233 (должен быть заменен на 80)"
    ((FAILED++))
  else
    echo -e "${GREEN}✅${NC} Порт 32233 заменен на 80"
    ((PASSED++))
  fi
  
  # Проверка, что endpoints используют порт 80
  if echo "$OIDC_DISCOVERY" | grep -q 'http://65.108.15.30/auth/v1' && ! echo "$OIDC_DISCOVERY" | grep -q 'http://65.108.15.30:[0-9]'; then
    echo -e "${GREEN}✅${NC} Auth endpoints используют порт 80"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠️${NC}  Проверьте auth endpoints вручную"
    ((WARNINGS++))
  fi
  
  # Показать ключевые endpoints
  echo ""
  echo "   Ключевые endpoints:"
  echo "$OIDC_DISCOVERY" | grep -E 'authorization_endpoint|token_endpoint|issuer' | sed 's/^/   /' || true
fi
echo ""

# 7. Итоговая статистика
echo "================================"
echo "📊 ИТОГИ:"
echo -e "   ${GREEN}✅ Успешно: $PASSED${NC}"
echo -e "   ${RED}❌ Ошибки: $FAILED${NC}"
echo -e "   ${YELLOW}⚠️  Предупреждения: $WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ Все тесты пройдены!${NC}"
  exit 0
else
  echo -e "${RED}❌ Обнаружены ошибки. Требуется исправление.${NC}"
  exit 1
fi
