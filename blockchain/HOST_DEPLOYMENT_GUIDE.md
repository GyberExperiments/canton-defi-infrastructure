# 🚀 РУКОВОДСТВО: Запуск Canton Validator напрямую на хосте

## ✅ ПРЕИМУЩЕСТВА ЭТОГО ПОДХОДА

- ✅ **Нет Docker-in-Docker** - простая архитектура
- ✅ **Нет проблем с bind mount** - файлы доступны напрямую
- ✅ **Нативная работа Docker Compose** - как задумано разработчиками
- ✅ **Легкий мониторинг** - все контейнеры видны на хосте
- ✅ **Простой troubleshooting** - стандартные Docker команды
- ✅ **Production-ready** - стабильное решение

---

## 📋 БЫСТРЫЙ СТАРТ

### Вариант 1: Автоматическая установка (рекомендуется)

```bash
# 1. Сделать скрипт исполняемым
chmod +x blockchain/scripts/deploy-host-direct.sh

# 2. Запустить установку
./blockchain/scripts/deploy-host-direct.sh
```

Скрипт автоматически:
- Создаст директории
- Извлечет compose.yaml из образа
- Настроит переменные окружения
- Создаст systemd service
- Настроит автозапуск

### Вариант 2: Ручная установка

```bash
# Подключение к серверу
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30

# 1. Создание директорий
mkdir -p /opt/canton-validator/{data,logs,config}
cd /opt/canton-validator

# 2. Логин в GHCR
gh auth token | docker login ghcr.io --username TheMacroeconomicDao --password-stdin

# 3. Извлечение compose.yaml из образа
docker pull ghcr.io/themacroeconomicdao/canton-node:0.5.8
docker run --rm --entrypoint cat \
  ghcr.io/themacroeconomicdao/canton-node:0.5.8 \
  /opt/canton/compose.yaml > compose.yaml

# 4. Создание .env файла
cat > .env << EOF
CANTON_API=https://sv.sv-1.dev.global.canton.network.sync.global
ONBOARDING_SECRET=<ваш_секрет>
PARTY_HINT=gyber-validator
VALIDATOR_MODE=0
CANTON_VERSION=0.5.8
IMAGE_TAG=0.5.8
IMAGE_REPO=ghcr.io/digital-asset/decentralized-canton-sync/docker/
SPLICE_POSTGRES_VERSION=14
NGINX_VERSION=1.25
MIGRATION_ID=0
SPLICE_DB_SERVER=postgres-splice
SPLICE_DB_PORT=5432
SPLICE_DB_USER=splice
SPLICE_DB_PASSWORD=splice
GHCR_TOKEN=$(gh auth token)
DOCKER_USERNAME=TheMacroeconomicDao
EOF

# 5. Исправление compose.yaml (убираем проблемный bind mount)
sed -i '/postgres-entrypoint.sh:\/postgres-entrypoint.sh/d' compose.yaml

# 6. Установка systemd service
cp blockchain/scripts/canton-validator.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable canton-validator.service

# 7. Запуск
systemctl start canton-validator.service
```

---

## 🔧 УПРАВЛЕНИЕ СЕРВИСОМ

### Основные команды

```bash
# Запуск
systemctl start canton-validator.service

# Остановка
systemctl stop canton-validator.service

# Перезапуск
systemctl restart canton-validator.service

# Статус
systemctl status canton-validator.service

# Логи (реальное время)
journalctl -u canton-validator.service -f

# Логи (последние 100 строк)
journalctl -u canton-validator.service -n 100

# Проверка контейнеров
docker ps
docker ps -a

# Логи конкретного контейнера
docker logs <container_name> -f
```

---

## 📊 МОНИТОРИНГ

### Проверка статуса всех сервисов

```bash
# Список всех контейнеров Canton
docker ps --filter "name=canton\|postgres\|participant\|validator\|wallet\|ans\|nginx"

# Использование ресурсов
docker stats --no-stream

# Проверка health endpoints
curl http://localhost:5003/health  # Validator API
curl http://localhost:4001/health  # Participant API
curl http://localhost:80/          # Nginx
```

### Проверка логов на ошибки

```bash
# Ошибки в systemd логах
journalctl -u canton-validator.service | grep -i "error\|failed\|exception"

# Ошибки в контейнерах
docker ps -q | xargs -I {} docker logs {} 2>&1 | grep -i "error\|failed"
```

---

## 🔍 TROUBLESHOOTING

### Проблема: Сервис не запускается

```bash
# 1. Проверить статус
systemctl status canton-validator.service

# 2. Проверить логи
journalctl -u canton-validator.service -n 50

# 3. Проверить .env файл
cat /opt/canton-validator/.env

# 4. Проверить compose.yaml
cat /opt/canton-validator/compose.yaml | head -50
```

### Проблема: Контейнеры не запускаются

```bash
# 1. Проверить доступность образов
docker images | grep -E "(canton|postgres|nginx)"

# 2. Проверить логи docker compose
cd /opt/canton-validator
docker compose -f compose.yaml logs

# 3. Запустить вручную для диагностики
docker compose -f compose.yaml up
```

### Проблема: PostgreSQL не запускается

```bash
# 1. Проверить логи postgres
docker logs postgres-splice

# 2. Проверить volumes
docker volume ls | grep postgres

# 3. Проверить права доступа
ls -la /opt/canton-validator/data
```

### Проблема: Нет доступа к GHCR

```bash
# 1. Обновить токен
gh auth token | docker login ghcr.io --username TheMacroeconomicDao --password-stdin

# 2. Проверить доступ
docker pull ghcr.io/themacroeconomicdao/canton-node:0.5.8
```

---

## 🔄 ОБНОВЛЕНИЕ

### Обновление до новой версии

```bash
# 1. Остановить сервис
systemctl stop canton-validator.service

# 2. Обновить образы
docker pull ghcr.io/themacroeconomicdao/canton-node:0.5.8

# 3. Извлечь новый compose.yaml
cd /opt/canton-validator
docker run --rm --entrypoint cat \
  ghcr.io/themacroeconomicdao/canton-node:0.5.8 \
  /opt/canton/compose.yaml > compose.yaml.new

# 4. Сравнить изменения
diff compose.yaml compose.yaml.new

# 5. Применить изменения
mv compose.yaml.new compose.yaml

# 6. Обновить .env (если нужно)
# CANTON_VERSION=0.4.20

# 7. Запустить
systemctl start canton-validator.service
```

---

## 📝 СТРУКТУРА ФАЙЛОВ

```
/opt/canton-validator/
├── compose.yaml          # Docker Compose конфигурация (извлечена из образа)
├── .env                  # Переменные окружения
├── data/                 # Persistent данные
│   ├── postgres/         # Данные PostgreSQL
│   └── canton/           # Данные Canton
├── logs/                 # Логи
└── config/               # Конфигурационные файлы
```

---

## 🔐 БЕЗОПАСНОСТЬ

### Рекомендации

1. **Ограничить доступ к .env файлу:**
   ```bash
   chmod 600 /opt/canton-validator/.env
   ```

2. **Использовать firewall:**
   ```bash
   # Открыть только необходимые порты
   ufw allow 80/tcp    # Nginx
   ufw allow 4001/tcp # Participant API
   ufw allow 5003/tcp # Validator API
   ```

3. **Регулярно обновлять образы:**
   ```bash
   docker pull ghcr.io/themacroeconomicdao/canton-node:0.5.8
   ```

---

## ✅ ПРОВЕРКА РАБОТОСПОСОБНОСТИ

После запуска проверьте:

1. ✅ Все контейнеры запущены: `docker ps`
2. ✅ Нет ошибок в логах: `journalctl -u canton-validator.service`
3. ✅ Health endpoints отвечают: `curl http://localhost:5003/health`
4. ✅ Валидатор подключен к сети: проверьте логи на "connected" или "synchronized"

---

## 📚 ДОПОЛНИТЕЛЬНЫЕ РЕСУРСЫ

- [Canton Network Documentation](https://docs.daml.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Systemd Service Documentation](https://www.freedesktop.org/software/systemd/man/systemd.service.html)

---

**Дата создания:** 28 ноября 2025  
**Версия:** 1.0  
**Статус:** Production Ready ✅
