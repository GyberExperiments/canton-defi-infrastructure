#!/bin/bash

# 🔧 Скрипт для обновления цен в ConfigMap из админки
# Использование: ./scripts/update-configmap-prices.sh

set -e

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Конфигурация
NAMESPACE="canton-otc-minimal-stage"
CONFIGMAP_NAME="canton-otc-config"

echo -e "${YELLOW}📊 Обновление цен в ConfigMap${NC}"
echo "Namespace: $NAMESPACE"
echo "ConfigMap: $CONFIGMAP_NAME"
echo ""

# Проверяем подключение к кластеру
echo -e "${YELLOW}🔍 Проверка подключения к Kubernetes...${NC}"
if ! kubectl cluster-info > /dev/null 2>&1; then
    echo -e "${RED}❌ Ошибка: не удалось подключиться к Kubernetes кластеру${NC}"
    echo "Убедитесь что у вас настроен kubectl и есть доступ к кластеру"
    exit 1
fi

# Получаем текущие значения из ConfigMap
echo -e "${YELLOW}📖 Текущие значения в ConfigMap:${NC}"
kubectl get configmap $CONFIGMAP_NAME -n $NAMESPACE -o yaml | grep -E "CANTON_COIN_BUY_PRICE_USD|CANTON_COIN_SELL_PRICE_USD" | grep -v "kubectl.kubernetes.io"

# Запрашиваем новые значения
echo ""
read -p "Введите новую цену покупки (Buy Price) [например: 0.77]: " BUY_PRICE
read -p "Введите новую цену продажи (Sell Price) [например: 0.22]: " SELL_PRICE

# Валидация ввода
if [[ -z "$BUY_PRICE" ]] || [[ -z "$SELL_PRICE" ]]; then
    echo -e "${RED}❌ Ошибка: цены не могут быть пустыми${NC}"
    exit 1
fi

# Проверка что buy price > sell price
if (( $(echo "$BUY_PRICE <= $SELL_PRICE" | bc -l) )); then
    echo -e "${RED}❌ Ошибка: цена покупки должна быть выше цены продажи${NC}"
    exit 1
fi

# Подтверждение
echo ""
echo -e "${YELLOW}⚠️  Внимание! Будут установлены следующие цены:${NC}"
echo "Buy Price: $BUY_PRICE"
echo "Sell Price: $SELL_PRICE"
echo ""
read -p "Продолжить? (y/N): " CONFIRM

if [[ "$CONFIRM" != "y" ]] && [[ "$CONFIRM" != "Y" ]]; then
    echo -e "${YELLOW}❌ Операция отменена${NC}"
    exit 0
fi

# Обновляем ConfigMap
echo ""
echo -e "${YELLOW}🔄 Обновление ConfigMap...${NC}"

kubectl patch configmap $CONFIGMAP_NAME -n $NAMESPACE --type merge -p "{
  \"data\": {
    \"CANTON_COIN_BUY_PRICE_USD\": \"$BUY_PRICE\",
    \"CANTON_COIN_SELL_PRICE_USD\": \"$SELL_PRICE\"
  }
}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ ConfigMap успешно обновлен!${NC}"
    
    # Показываем новые значения
    echo ""
    echo -e "${YELLOW}📊 Новые значения в ConfigMap:${NC}"
    kubectl get configmap $CONFIGMAP_NAME -n $NAMESPACE -o yaml | grep -E "CANTON_COIN_BUY_PRICE_USD|CANTON_COIN_SELL_PRICE_USD" | grep -v "kubectl.kubernetes.io"
    
    echo ""
    echo -e "${GREEN}✅ Готово! Новые цены применены.${NC}"
    echo -e "${YELLOW}ℹ️  Примечание: Приложение автоматически загрузит новые значения из ConfigMap${NC}"
else
    echo -e "${RED}❌ Ошибка при обновлении ConfigMap${NC}"
    exit 1
fi
