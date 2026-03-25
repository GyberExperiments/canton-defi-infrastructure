#!/usr/bin/env bash
# 🚀 Скрипт развертывания Canton Validator напрямую на хосте (без Docker-in-Docker)
# Использование: ./deploy-host-direct.sh

set -euo pipefail

SERVER_IP="65.108.15.30"
SSH_KEY="${HOME}/.ssh/id_rsa_canton"
DEPLOY_DIR="/opt/canton-validator"
CANTON_VERSION="0.5.8"

echo "🚀 Развертывание Canton Validator на хосте ${SERVER_IP}"

# Проверка SSH ключа
if [ ! -f "${SSH_KEY}" ]; then
    echo "❌ SSH ключ не найден: ${SSH_KEY}"
    exit 1
fi

# Запрос переменных окружения
read -p "CANTON_API (default: https://sv.sv-1.dev.global.canton.network.sync.global): " CANTON_API
CANTON_API="${CANTON_API:-https://sv.sv-1.dev.global.canton.network.sync.global}"

read -p "ONBOARDING_SECRET: " ONBOARDING_SECRET
if [ -z "${ONBOARDING_SECRET}" ]; then
    echo "❌ ONBOARDING_SECRET обязателен!"
    exit 1
fi

read -p "PARTY_HINT (default: gyber-validator): " PARTY_HINT
PARTY_HINT="${PARTY_HINT:-gyber-validator}"

read -p "VALIDATOR_MODE (0=validator, 1=observer, default: 0): " VALIDATOR_MODE
VALIDATOR_MODE="${VALIDATOR_MODE:-0}"

read -p "GHCR_TOKEN (для доступа к образам): " GHCR_TOKEN

echo ""
echo "📋 Конфигурация:"
echo "  CANTON_API: ${CANTON_API}"
echo "  PARTY_HINT: ${PARTY_HINT}"
echo "  VALIDATOR_MODE: ${VALIDATOR_MODE}"
echo "  DEPLOY_DIR: ${DEPLOY_DIR}"
echo ""

read -p "Продолжить? (y/n): " confirm
if [ "${confirm}" != "y" ]; then
    echo "Отменено"
    exit 0
fi

# Выполнение на сервере через SSH
echo "🔌 Подключение к серверу ${SERVER_IP}..."
echo "⚠️  ВСЕ КОМАНДЫ ВЫПОЛНЯЮТСЯ НА СЕРВЕРЕ, НЕ ЛОКАЛЬНО!"
echo ""

# Передаем переменные через heredoc (без кавычек для подстановки)
ssh -i "${SSH_KEY}" root@"${SERVER_IP}" bash << REMOTE_SCRIPT
set -euo pipefail

# Все команды ниже выполняются НА СЕРВЕРЕ
echo "📦 Подготовка окружения на сервере \$(hostname)..."

# Переменные переданы из локального скрипта
CANTON_API="${CANTON_API}"
ONBOARDING_SECRET="${ONBOARDING_SECRET}"
PARTY_HINT="${PARTY_HINT}"
VALIDATOR_MODE="${VALIDATOR_MODE}"
GHCR_TOKEN="${GHCR_TOKEN}"
CANTON_VERSION="${CANTON_VERSION}"

# 1. Создание директорий
DEPLOY_DIR="/opt/canton-validator"
mkdir -p \${DEPLOY_DIR}/{data,logs,config}
cd \${DEPLOY_DIR}

# 2. Логин в GHCR
if [ -n "\${GHCR_TOKEN}" ]; then
    echo "🔐 Логин в GHCR..."
    echo "\${GHCR_TOKEN}" | docker login ghcr.io --username TheMacroeconomicDao --password-stdin || echo "⚠️  Логин не удался, продолжаем..."
fi

# 3. Извлечение compose.yaml из образа
echo "📥 Извлечение compose.yaml из образа..."
docker pull ghcr.io/themacroeconomicdao/canton-node:\${CANTON_VERSION} || true
docker run --rm --entrypoint cat \\
  ghcr.io/themacroeconomicdao/canton-node:\${CANTON_VERSION} \\
  /opt/canton/compose.yaml > compose.yaml

# 4. Извлечение postgres-entrypoint.sh (если нужен)
echo "📥 Извлечение postgres-entrypoint.sh..."
docker run --rm --entrypoint cat \\
  ghcr.io/themacroeconomicdao/canton-node:\${CANTON_VERSION} \\
  /opt/canton/postgres-entrypoint.sh > postgres-entrypoint.sh 2>/dev/null || echo "⚠️  postgres-entrypoint.sh не найден, используем стандартный"

chmod +x postgres-entrypoint.sh 2>/dev/null || true

# 5. Создание .env файла
echo "📝 Создание .env файла..."
cat > .env << ENVEOF
CANTON_API=\${CANTON_API}
ONBOARDING_SECRET=\${ONBOARDING_SECRET}
PARTY_HINT=\${PARTY_HINT}
VALIDATOR_MODE=\${VALIDATOR_MODE}
CANTON_VERSION=\${CANTON_VERSION}
IMAGE_TAG=\${CANTON_VERSION}
IMAGE_REPO=ghcr.io/digital-asset/decentralized-canton-sync/docker/
SPLICE_POSTGRES_VERSION=14
NGINX_VERSION=1.25
MIGRATION_ID=0
SPLICE_DB_SERVER=postgres-splice
SPLICE_DB_PORT=5432
SPLICE_DB_USER=splice
SPLICE_DB_PASSWORD=splice
GHCR_TOKEN=\${GHCR_TOKEN}
DOCKER_USERNAME=TheMacroeconomicDao
ENVEOF
chmod 600 .env

# 6. Исправление compose.yaml для работы на хосте
echo "🔧 Исправление compose.yaml..."

# Убираем проблемный bind mount для postgres-entrypoint.sh (проблема Docker-in-Docker)
sed -i '/postgres-entrypoint.sh:\/postgres-entrypoint.sh/d' compose.yaml
sed -i 's|\.\/postgres-entrypoint.sh:\/postgres-entrypoint.sh||g' compose.yaml

# Если postgres-entrypoint.sh существует локально, используем его
if [ -f "postgres-entrypoint.sh" ]; then
    echo "✅ Используем локальный postgres-entrypoint.sh"
    # Добавляем volume для postgres-entrypoint.sh в секцию postgres-splice
    sed -i '/postgres-splice:/,/volumes:/ {
        /volumes:/a\    - ./postgres-entrypoint.sh:/postgres-entrypoint.sh:ro
    }' compose.yaml || echo "⚠️  Не удалось добавить postgres-entrypoint.sh в volumes"
else
    echo "⚠️  postgres-entrypoint.sh не найден, используем стандартный postgres entrypoint"
fi

# 7. Создание systemd service
echo "⚙️  Создание systemd service..."
cat > /etc/systemd/system/canton-validator.service << 'SERVICEEOF'
[Unit]
Description=Canton Validator Node (Direct Host Deployment)
Documentation=https://docs.daml.com/
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service
ConditionPathExists=/opt/canton-validator

[Service]
Type=oneshot
RemainAfterExit=yes
User=root
WorkingDirectory=/opt/canton-validator
EnvironmentFile=/opt/canton-validator/.env

# Логин в GHCR перед запуском
ExecStartPre=/usr/bin/bash -c 'if [ -n "${GHCR_TOKEN:-}" ]; then echo "${GHCR_TOKEN}" | docker login ghcr.io --username "${DOCKER_USERNAME:-TheMacroeconomicDao}" --password-stdin || true; fi'

# Запуск docker compose
ExecStart=/usr/bin/docker compose -f /opt/canton-validator/compose.yaml up -d --remove-orphans
ExecStop=/usr/bin/docker compose -f /opt/canton-validator/compose.yaml down --remove-orphans

Restart=on-failure
RestartSec=10
StartLimitInterval=600
StartLimitBurst=3

StandardOutput=journal
StandardError=journal
SyslogIdentifier=canton-validator

[Install]
WantedBy=multi-user.target
SERVICEEOF

# 8. Перезагрузка systemd
echo "⚙️  Перезагрузка systemd..."
systemctl daemon-reload

# 9. Остановка старых контейнеров (если есть)
echo "🛑 Остановка старых контейнеров..."
cd \${DEPLOY_DIR}
docker compose -f compose.yaml down 2>/dev/null || true
docker stop canton-validator 2>/dev/null || true
docker rm canton-validator 2>/dev/null || true

# 10. Включение автозапуска
echo "✅ Включение автозапуска..."
systemctl enable canton-validator.service

echo ""
echo "✅ Установка завершена на сервере!"
echo ""
echo "📊 Следующие шаги (выполнить на сервере):"
echo "  1. Запуск: systemctl start canton-validator.service"
echo "  2. Статус: systemctl status canton-validator.service"
echo "  3. Логи: journalctl -u canton-validator.service -f"
echo "  4. Контейнеры: docker ps"
REMOTE_SCRIPT

echo ""
echo "✅ Развертывание завершено!"
echo ""
echo "🔗 Подключение к серверу:"
echo "   ssh -i ${SSH_KEY} root@${SERVER_IP}"
echo ""
echo "📋 Команды управления:"
echo "   systemctl start canton-validator.service   # Запуск"
echo "   systemctl stop canton-validator.service    # Остановка"
echo "   systemctl status canton-validator.service # Статус"
echo "   journalctl -u canton-validator.service -f  # Логи"
echo "   docker ps                                   # Контейнеры"
