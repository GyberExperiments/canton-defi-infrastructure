#!/bin/bash

# Скрипт для запуска Canton Validator
# Использование: ./start-canton-validator.sh [onboarding_secret]

set -e

SERVER="root@65.108.15.30"
SSH_KEY="$HOME/.ssh/id_rsa_canton"
CONTAINER_NAME="canton-validator"
IMAGE_NAME="canton-node-fixed:latest"

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 Запуск Canton Validator${NC}"
echo ""

# Получаем onboarding secret
if [ -n "$1" ]; then
    ONBOARDING_SECRET="$1"
    echo -e "${YELLOW}Используется предоставленный secret${NC}"
else
    echo "Получаю onboarding secret..."
    RESPONSE=$(curl -s -X POST "https://sv.sv-1.dev.global.canton.network.sync.global/api/sv/v0/devnet/onboard/validator/prepare" --max-time 60)
    
    if command -v jq &> /dev/null; then
        ONBOARDING_SECRET=$(echo "$RESPONSE" | jq -r '.onboarding_secret // empty')
    else
        ONBOARDING_SECRET=$(echo "$RESPONSE" | grep -o '"onboarding_secret":"[^"]*"' | cut -d'"' -f4)
    fi
    
    if [ -z "$ONBOARDING_SECRET" ] || [ "$ONBOARDING_SECRET" = "null" ]; then
        echo -e "${RED}❌ Не удалось получить onboarding secret${NC}"
        echo "Response: $RESPONSE"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Secret получен: ${ONBOARDING_SECRET:0:20}...${NC}"
echo ""

# Проверяем существующий контейнер
echo "Проверяю существующий контейнер..."
EXISTING=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER" "docker ps -a --filter name=$CONTAINER_NAME --format '{{.Names}}' 2>/dev/null || echo ''")

if [ -n "$EXISTING" ]; then
    echo -e "${YELLOW}⚠️  Контейнер $CONTAINER_NAME уже существует${NC}"
    read -p "Остановить и удалить существующий контейнер? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Останавливаю и удаляю контейнер..."
        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER" "docker stop $CONTAINER_NAME 2>/dev/null; docker rm $CONTAINER_NAME 2>/dev/null"
    else
        echo "Отменено"
        exit 0
    fi
fi

# Запускаем контейнер
echo -e "${GREEN}Запускаю контейнер...${NC}"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER" "docker run -d \
  --name $CONTAINER_NAME \
  --restart unless-stopped \
  --network host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /opt/canton-validator/data:/opt/canton/data \
  -v /opt/canton-validator/logs:/opt/canton/logs \
  -e CANTON_API='https://sv.sv-1.dev.global.canton.network.sync.global' \
  -e ONBOARDING_SECRET='$ONBOARDING_SECRET' \
  -e PARTY_HINT='gyber-validator' \
  -e VALIDATOR_MODE='0' \
  $IMAGE_NAME"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Контейнер запущен!${NC}"
    echo ""
    echo "Проверяю статус..."
    sleep 3
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER" "docker ps --filter name=$CONTAINER_NAME"
    echo ""
    echo "Последние логи:"
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER" "docker logs --tail=20 $CONTAINER_NAME"
else
    echo -e "${RED}❌ Ошибка при запуске контейнера${NC}"
    exit 1
fi





