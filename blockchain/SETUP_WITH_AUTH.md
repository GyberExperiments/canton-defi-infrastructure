# 🔐 Настройка авторизации Docker через GitHub Secrets

## Команды для выполнения на сервере

### 1. Создание entrypoint скрипта для авторизации

```bash
cat > /opt/canton-validator/docker-entrypoint-with-auth.sh << 'SCRIPT_EOF'
#!/bin/bash
set -e

echo "=== Docker Entrypoint: Настройка авторизации ==="

if [ -n "$DOCKER_PASSWORD" ] && [ -n "$DOCKER_USERNAME" ]; then
    echo "Логин в GHCR внутри контейнера..."
    echo "$DOCKER_PASSWORD" | docker login ghcr.io --username "$DOCKER_USERNAME" --password-stdin || {
        echo "WARNING: Не удалось залогиниться в GHCR"
    }
else
    echo "WARNING: DOCKER_USERNAME или DOCKER_PASSWORD не установлены"
fi

if [ ! -S /var/run/docker.sock ]; then
    echo "ERROR: /var/run/docker.sock не найден"
    exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: Docker CLI не найден"
    exit 1
fi

echo "✓ Авторизация настроена, запуск оригинального entrypoint..."
exec /usr/bin/tini -- /opt/canton/start.sh "$@"
SCRIPT_EOF

chmod +x /opt/canton-validator/docker-entrypoint-with-auth.sh
```

### 2. Обновление .env файла (убедитесь что все переменные есть)

```bash
cat > /opt/canton-validator/.env << 'EOF'
# GHCR Credentials (из GitHub Secrets)
DOCKER_USERNAME=TheMacroeconomicDao
DOCKER_PASSWORD=$GITHUB_TOKEN

# Canton Configuration
CANTON_API=https://sv.sv-1.dev.global.canton.network.sync.global
ONBOARDING_SECRET=$ONBOARDING_SECRET
PARTY_HINT=gyber-validator
VALIDATOR_MODE=0
CANTON_VERSION=0.5.8

# Network Configuration
PUBLIC_IP=65.108.15.30
HTTP_PORT=80
PARTICIPANT_LEDGER_API_PORT=4001
PARTICIPANT_ADMIN_API_PORT=4002
VALIDATOR_API_PORT=5003
VALIDATOR_ADMIN_PORT=5004

# Database
POSTGRES_PASSWORD=canton_secure_password_$(openssl rand -hex 8)
POSTGRES_USER=postgres
POSTGRES_DB=canton

# Переменные для внутреннего compose.yaml образа canton-node
SPLICE_DB_SERVER=postgres
SPLICE_DB_PORT=5432
SPLICE_DB_USER=postgres
SPLICE_DB_PASSWORD=${POSTGRES_PASSWORD}
SPLICE_POSTGRES_VERSION=14
IMAGE_REPO=ghcr.io/themacroeconomicdao/
NGINX_VERSION=latest
LEDGER_API_ADMIN_USER=admin
WALLET_ADMIN_USER=admin

# Paths
DATA_DIR=/opt/canton-validator/data
LOGS_DIR=/opt/canton-validator/logs
EOF
```

### 3. Обновление docker-compose.yaml с entrypoint для авторизации

```bash
python3 << 'PYTHON_EOF'
content = """services:
  postgres:
    image: postgres:14
    container_name: canton-postgres
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - ${DATA_DIR}/postgres:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - canton-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  canton-validator:
    image: ghcr.io/themacroeconomicdao/canton-node:0.5.8
    container_name: canton-validator
    depends_on:
      postgres:
        condition: service_healthy
    group_add:
      - 988
    environment:
      - CANTON_API=${CANTON_API}
      - ONBOARDING_SECRET=${ONBOARDING_SECRET}
      - PARTY_HINT=${PARTY_HINT}
      - VALIDATOR_MODE=${VALIDATOR_MODE}
      - CANTON_VERSION=0.5.8
      - POSTGRES_HOST=postgres
      - POSTGRES_PORT=5432
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - PUBLIC_IP=${PUBLIC_IP}
      - SPLICE_DB_SERVER=postgres
      - SPLICE_DB_PORT=5432
      - SPLICE_DB_USER=${POSTGRES_USER}
      - SPLICE_DB_PASSWORD=${POSTGRES_PASSWORD}
      - SPLICE_POSTGRES_VERSION=14
      - IMAGE_REPO=ghcr.io/themacroeconomicdao/
      - NGINX_VERSION=latest
      - LEDGER_API_ADMIN_USER=admin
      - WALLET_ADMIN_USER=admin
      - DOCKER_USERNAME=${DOCKER_USERNAME}
      - DOCKER_PASSWORD=$GITHUB_TOKEN
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /usr/bin/docker:/usr/bin/docker:ro
      - /usr/libexec/docker/cli-plugins:/usr/libexec/docker/cli-plugins:ro
      - /opt/canton-validator/docker-entrypoint-with-auth.sh:/docker-entrypoint-with-auth.sh:ro
      - ${DATA_DIR}/canton:/opt/canton/data
      - ${LOGS_DIR}:/opt/canton/logs
    entrypoint: ["/bin/bash", "/docker-entrypoint-with-auth.sh"]
    ports:
      - "${HTTP_PORT}:80"
      - "${PARTICIPANT_LEDGER_API_PORT}:4001"
      - "${PARTICIPANT_ADMIN_API_PORT}:4002"
      - "${VALIDATOR_API_PORT}:5003"
      - "${VALIDATOR_ADMIN_PORT}:5004"
    networks:
      - canton-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5003"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

networks:
  canton-network:
    driver: bridge
"""

with open('/opt/canton-validator/docker-compose.yaml', 'w') as f:
    f.write(content)
print("✓ Docker-compose.yaml обновлен")
PYTHON_EOF
```

### 4. Логин в GHCR на хосте

```bash
cd /opt/canton-validator
source .env
echo "$DOCKER_PASSWORD" | docker login ghcr.io --username "$DOCKER_USERNAME" --password-stdin
```

### 5. Обновление systemd service

```bash
python3 << 'PYTHON_EOF'
content = """[Unit]
Description=Canton Validator with Docker Compose
Documentation=https://docs.daml.com/
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service
ConditionPathExists=/opt/canton-validator

[Service]
Type=exec
User=root
WorkingDirectory=/opt/canton-validator
EnvironmentFile=/opt/canton-validator/.env

ExecStartPre=/usr/bin/bash -c 'docker network create canton-network 2>/dev/null || true'
ExecStartPre=/usr/bin/bash -c 'echo "${DOCKER_PASSWORD}" | docker login ghcr.io --username ${DOCKER_USERNAME} --password-stdin'

ExecStart=/usr/bin/docker compose -f /opt/canton-validator/docker-compose.yaml up --remove-orphans
ExecStop=/usr/bin/docker compose -f /opt/canton-validator/docker-compose.yaml down --remove-orphans

Restart=always
RestartSec=10
StartLimitInterval=600
StartLimitBurst=3

StandardOutput=journal
StandardError=journal
SyslogIdentifier=canton-validator

[Install]
WantedBy=multi-user.target
"""

with open('/etc/systemd/system/canton-validator.service', 'w') as f:
    f.write(content)
print("✓ Systemd service обновлен")
PYTHON_EOF
```

### 6. Перезапуск сервиса

```bash
systemctl daemon-reload
systemctl stop canton-validator.service
docker compose -f /opt/canton-validator/docker-compose.yaml down
systemctl start canton-validator.service
```

### 7. Проверка статуса

```bash
sleep 30
systemctl status canton-validator.service --no-pager | head -40
```

### 8. Проверка логов

```bash
journalctl -u canton-validator.service -n 50 --no-pager | tail -30
```

### 9. Проверка внутренних контейнеров

```bash
sleep 30
docker exec canton-validator docker ps 2>/dev/null && echo "✓ Внутренние контейнеры запущены" || echo "⚠ Контейнеры еще запускаются"
```

### 10. Тестирование API

```bash
curl -s http://localhost:80 | head -5 && echo "✓ Web UI OK" || echo "✗ Web UI FAIL"
curl -s http://localhost:4001 > /dev/null && echo "✓ Participant API OK" || echo "✗ Participant API FAIL"
curl -s http://localhost:5003 > /dev/null && echo "✓ Validator API OK" || echo "✗ Validator API FAIL"
```






