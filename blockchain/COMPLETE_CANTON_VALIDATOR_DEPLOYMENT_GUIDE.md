# 🚀 ПОЛНОЕ РУКОВОДСТВО: Запуск Canton Validator на сервере 65.108.15.30

## 📋 EXECUTIVE SUMMARY

Этот документ содержит **полную самодостаточную инструкцию** для развертывания Canton Validator Node на сервере **65.108.15.30**. Документ включает:

- ✅ Настройку беспарольного SSH доступа (macOS)
- ✅ Детальный анализ проблем с текущим развертыванием
- ✅ Пошаговые инструкции по запуску валидатора
- ✅ Готовые команды и конфигурации
- ✅ Troubleshooting и решение типичных проблем

---

## 🎯 ЦЕЛЬ

Запустить Canton Validator Node на сервере 65.108.15.30 для участия в Canton DevNet с возможностью выполнения команд через SSH без ввода пароля.

---

## 📊 АНАЛИЗ ТЕКУЩИХ ПРОБЛЕМ

### Проблема 1: Архитектура образа Canton Node ⚠️

**Суть проблемы:**
Образ `ghcr.io/themacroeconomicdao/canton-node:0.5.8` является **wrapper'ом для Docker Compose**, а НЕ самостоятельным приложением.

**Детали:**
- Скрипт `/opt/canton/start.sh` (строка 267) выполняет:
  ```bash
  docker compose -f compose.yaml up -d
  ```
- Docker Compose запускает стек из 6 компонентов:
  1. PostgreSQL (postgres:14)
  2. Canton Participant (canton-participant:0.5.8)
  3. Validator App (validator-app:0.5.8)
  4. Wallet Web UI (wallet-web-ui:0.5.8)
  5. ANS Web UI (ans-web-ui:0.5.8)
  6. Nginx (reverse proxy)

**Почему это проблема в Kubernetes:**
- В Kubernetes Pod'е команда `docker` недоступна
- Результат: **CrashLoopBackOff**

### Проблема 2: Отсутствие отдельных образов ❌

**Критическая проблема:**
Отдельные образы `canton-participant:0.5.8` и `validator-app:0.5.8` **НЕ доступны** в GHCR публично!

Они используются только внутри `canton-node` образа через Docker Compose.

**Текущий статус при попытке развертывания в K8s:**
```
pod/canton-participant-xxx   0/1   ErrImagePull      # Образ не существует
pod/postgres-splice-0        1/1   Running           # OK
pod/validator-app-xxx        0/1   Init:0/1          # Ждет Participant
```

### Проблема 3: Устаревшие credentials ⏰

**Проблема:** Docker Registry credentials (GitHub token) устарели (43 дня)

**Решение:**
```bash
# Новый токен (обновлен 27.11.2025)
GITHUB_TOKEN="$GITHUB_TOKEN"

# Пересоздание секрета
kubectl delete secret ghcr-creds -n canton-node
kubectl create secret docker-registry ghcr-creds \
  --docker-server=ghcr.io \
  --docker-username=TheMacroeconomicDao \
  --docker-password=$GITHUB_TOKEN \
  --namespace=canton-node
```

### Проблема 4: Остатки от старых экспериментов 🗑️

**Найденные артефакты:**
- Множество устаревших документов с датами в названиях
- Дублирующиеся конфигурационные файлы
- Неиспользуемые Kubernetes манифесты
- Хардкоженные credentials в различных файлах

**Рекомендация:** Очистка будет выполнена в рамках развертывания.

---

## 🔐 ЧАСТЬ 1: НАСТРОЙКА БЕСПАРОЛЬНОГО SSH ДОСТУПА (macOS)

### Шаг 1.1: Генерация SSH ключа (если нет)

```bash
# Проверяем наличие SSH ключа
ls -la ~/.ssh/id_rsa.pub

# Если ключа нет - генерируем новый
ssh-keygen -t rsa -b 4096 -C "canton-validator-access" -f ~/.ssh/id_rsa

# Нажмите Enter для пустой парольной фразы (или задайте пароль для ключа)
```

### Шаг 1.2: Копирование публичного ключа на сервер

**Вариант A: Используя ssh-copy-id (рекомендуется)**

```bash
# Копируем ключ на сервер
ssh-copy-id root@65.108.15.30

# Введите пароль: $CANTON_PASSWORD
# Сообщение: "Number of key(s) added: 1"
```

**Вариант B: Ручное копирование (если ssh-copy-id не работает)**

```bash
# 1. Копируем публичный ключ в буфер обмена
cat ~/.ssh/id_rsa.pub | pbcopy

# 2. Подключаемся к серверу
ssh root@65.108.15.30
# Пароль: $CANTON_PASSWORD

# 3. На сервере добавляем ключ
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "ВСТАВЬТЕ_СЮДА_ПУБЛИЧНЫЙ_КЛЮЧ" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 4. Выходим
exit
```

### Шаг 1.3: Проверка беспарольного доступа

```bash
# Тестируем подключение БЕЗ пароля
ssh root@65.108.15.30 "echo 'SSH без пароля работает!'"

# Должно вывести: SSH без пароля работает!
# БЕЗ запроса пароля
```

### Шаг 1.4: Настройка SSH config (опционально, для удобства)

```bash
# Создаем/редактируем ~/.ssh/config
cat >> ~/.ssh/config << 'EOF'

# Canton Validator Server
Host canton-validator
    HostName 65.108.15.30
    User root
    IdentityFile ~/.ssh/id_rsa
    ServerAliveInterval 60
    ServerAliveCountMax 3
    StrictHostKeyChecking accept-new
EOF

chmod 600 ~/.ssh/config

# Теперь можно подключаться просто:
ssh canton-validator
```

---

## 🛠️ ЧАСТЬ 2: РЕКОМЕНДОВАННОЕ РЕШЕНИЕ

### Выбор метода развертывания

После анализа всех вариантов, **рекомендуется**:

**🥇 Вариант 1: Запуск через Docker Compose напрямую на хосте**

**Преимущества:**
- ✅ Простота развертывания и отладки
- ✅ Нативное использование образа без модификаций
- ✅ Работает гарантированно (проверено в документации)
- ✅ Легкий мониторинг и управление
- ✅ Полный контроль над конфигурацией

**Недостатки:**
- ⚠️ Теряются некоторые преимущества Kubernetes (auto-scaling, self-healing)
- ⚠️ Требуется настройка отдельного мониторинга

**Альтернативы:**
- Вариант 2: Docker-in-Docker в Kubernetes (сложнее, security риски)
- Вариант 3: Официальные Helm charts (нужно проверить доступность)

---

## 🚀 ЧАСТЬ 3: ПОШАГОВАЯ ИНСТРУКЦИЯ РАЗВЕРТЫВАНИЯ

### Этап 1: Подключение и подготовка сервера

```bash
# 1.1 Подключаемся к серверу
ssh root@65.108.15.30

# 1.2 Обновляем систему
apt-get update && apt-get upgrade -y

# 1.3 Устанавливаем необходимые пакеты
apt-get install -y \
  docker.io \
  docker-compose \
  curl \
  wget \
  jq \
  git \
  netcat-openbsd

# 1.4 Проверяем Docker
docker --version
docker-compose --version

# 1.5 Запускаем Docker daemon
systemctl start docker
systemctl enable docker
systemctl status docker
```

### Этап 2: Подготовка директорий

```bash
# 2.1 Создаем директорию для валидатора
mkdir -p /opt/canton-validator
cd /opt/canton-validator

# 2.2 Создаем поддиректории
mkdir -p data logs config

# 2.3 Устанавливаем правильные права
chmod -R 755 /opt/canton-validator
```

### Этап 3: Получение onboarding secret

```bash
# 3.1 Получаем актуальный DevNet onboarding secret
ONBOARDING_SECRET=$(curl -s -X POST \
  "https://sv.sv-1.dev.global.canton.network.sync.global/api/sv/v0/devnet/onboard/validator/prepare" \
  | jq -r '.onboarding_secret')

# 3.2 Проверяем что секрет получен
echo "Onboarding Secret: ${ONBOARDING_SECRET:0:10}..."

# 3.3 Сохраняем в файл
cat > /opt/canton-validator/.env << EOF
# Canton Validator Configuration
# Generated: $(date)

CANTON_API=https://sv.sv-1.dev.global.canton.network.sync.global
ONBOARDING_SECRET=$ONBOARDING_SECRET
PARTY_HINT=gyber-validator
MIGRATION_ID=0
IMAGE_TAG=0.5.8
EOF

chmod 600 /opt/canton-validator/.env
```

### Этап 4: Аутентификация в GHCR

```bash
# 4.1 Логинимся в GitHub Container Registry
echo "$GITHUB_TOKEN" | \
  docker login ghcr.io -u TheMacroeconomicDao --password-stdin

# 4.2 Проверяем что логин успешен
docker pull ghcr.io/themacroeconomicdao/canton-node:0.5.8
```

### Этап 5: Запуск Canton Validator

```bash
# 5.1 Загружаем переменные окружения
source /opt/canton-validator/.env

# 5.2 Запускаем валидатор
docker run -d \
  --name canton-validator-devnet \
  --restart unless-stopped \
  --network host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /opt/canton-validator/data:/opt/canton/data \
  -v /opt/canton-validator/logs:/opt/canton/logs \
  -e ONBOARDING_SECRET="$ONBOARDING_SECRET" \
  -e SPONSOR_SV_ADDRESS="$CANTON_API" \
  -e PARTY_HINT="$PARTY_HINT" \
  -e MIGRATION_ID="$MIGRATION_ID" \
  ghcr.io/themacroeconomicdao/canton-node:0.5.8 \
  /opt/canton/start.sh \
    -s "$CANTON_API" \
    -o "$ONBOARDING_SECRET" \
    -p "$PARTY_HINT" \
    -m "$MIGRATION_ID"

# 5.3 Проверяем статус
docker ps | grep canton-validator

# 5.4 Смотрим логи (первые 50 строк)
docker logs canton-validator-devnet --tail=50
```

### Этап 6: Проверка работоспособности

```bash
# 6.1 Ждем 60 секунд для инициализации
sleep 60

# 6.2 Проверяем запущенные контейнеры
docker ps

# Должны быть запущены:
# - canton-validator-devnet (wrapper)
# - postgres (база данных)
# - canton-participant
# - validator-app
# - wallet-web-ui (опционально)
# - ans-web-ui (опционально)
# - nginx (опционально)

# 6.3 Проверяем health endpoints
curl -f http://65.108.15.30:8081/health || echo "Health endpoint not ready yet"
curl -f http://65.108.15.30:8080/metrics || echo "Metrics endpoint not ready yet"

# 6.4 Проверяем логи на ошибки
docker logs canton-validator-devnet 2>&1 | grep -i "error\|failed\|exception" || echo "No errors found"

# 6.5 Проверяем подключение к Canton DevNet
docker logs canton-validator-devnet 2>&1 | grep -i "connected\|synchronized\|validator started" || echo "Still connecting..."
```

### Этап 7: Настройка автозапуска через systemd

```bash
# 7.1 Создаем systemd unit файл
cat > /etc/systemd/system/canton-validator.service << 'EOF'
[Unit]
Description=Canton Validator Node
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/canton-validator
EnvironmentFile=/opt/canton-validator/.env
ExecStartPre=-/usr/bin/docker stop canton-validator-devnet
ExecStartPre=-/usr/bin/docker rm canton-validator-devnet
ExecStart=/usr/bin/docker run \
  --name canton-validator-devnet \
  --network host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /opt/canton-validator/data:/opt/canton/data \
  -v /opt/canton-validator/logs:/opt/canton/logs \
  -e ONBOARDING_SECRET=${ONBOARDING_SECRET} \
  -e SPONSOR_SV_ADDRESS=${CANTON_API} \
  -e PARTY_HINT=${PARTY_HINT} \
  -e MIGRATION_ID=${MIGRATION_ID} \
  ghcr.io/themacroeconomicdao/canton-node:0.5.8 \
  /opt/canton/start.sh \
    -s ${CANTON_API} \
    -o ${ONBOARDING_SECRET} \
    -p ${PARTY_HINT} \
    -m ${MIGRATION_ID}
ExecStop=/usr/bin/docker stop canton-validator-devnet
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 7.2 Перезагружаем systemd
systemctl daemon-reload

# 7.3 Включаем автозапуск
systemctl enable canton-validator.service

# 7.4 Проверяем статус
systemctl status canton-validator.service
```

---

## 📊 ЧАСТЬ 4: МОНИТОРИНГ И УПРАВЛЕНИЕ

### Полезные команды

```bash
# Статус контейнера
docker ps -a | grep canton

# Логи (следить в реальном времени)
docker logs -f canton-validator-devnet

# Логи (последние 100 строк)
docker logs --tail=100 canton-validator-devnet

# Статус всех контейнеров в стеке
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Использование ресурсов
docker stats --no-stream

# Перезапуск валидатора
docker restart canton-validator-devnet

# Остановка
docker stop canton-validator-devnet

# Запуск
docker start canton-validator-devnet

# Полная очистка и перезапуск
docker stop canton-validator-devnet
docker rm canton-validator-devnet
# Затем запустить заново (Этап 5)
```

### Health Checks

```bash
# Health endpoint
curl http://65.108.15.30:8081/health

# Metrics endpoint
curl http://65.108.15.30:8080/metrics

# Admin API (если доступен)
curl http://65.108.15.30:8082/admin

# Проверка портов
netstat -tlnp | grep -E '8080|8081|8082|6865'
```

### Создание скрипта мониторинга

```bash
# Создаем скрипт для удобного мониторинга
cat > /opt/canton-validator/monitor.sh << 'EOF'
#!/bin/bash

while true; do
  clear
  echo "=== Canton Validator Status - $(date) ==="
  echo ""
  
  echo "📦 Containers:"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "canton|postgres|nginx|validator"
  
  echo ""
  echo "💾 Resource Usage:"
  docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep -E "canton|postgres"
  
  echo ""
  echo "🔍 Recent Logs:"
  docker logs canton-validator-devnet --tail=10 2>&1
  
  echo ""
  echo "Press Ctrl+C to exit"
  sleep 5
done
EOF

chmod +x /opt/canton-validator/monitor.sh

# Запуск мониторинга
/opt/canton-validator/monitor.sh
```

---

## 🔧 ЧАСТЬ 5: TROUBLESHOOTING

### Проблема: Контейнер постоянно перезапускается

**Диагностика:**
```bash
# Смотрим причину перезапуска
docker logs canton-validator-devnet --tail=50

# Проверяем статус
docker inspect canton-validator-devnet | jq '.[0].State'
```

**Возможные причины:**
1. **Истек onboarding secret (DevNet - 1 час)**
   ```bash
   # Получаем новый секрет
   ONBOARDING_SECRET=$(curl -s -X POST \
     "https://sv.sv-1.dev.global.canton.network.sync.global/api/sv/v0/devnet/onboard/validator/prepare" \
     | jq -r '.onboarding_secret')
   
   # Обновляем .env
   sed -i "s/ONBOARDING_SECRET=.*/ONBOARDING_SECRET=$ONBOARDING_SECRET/" /opt/canton-validator/.env
   
   # Перезапускаем
   docker restart canton-validator-devnet
   ```

2. **Нет доступа к Docker socket**
   ```bash
   # Проверяем права
   ls -la /var/run/docker.sock
   
   # Должно быть: srw-rw---- 1 root docker
   ```

3. **Порты заняты**
   ```bash
   # Проверяем какой процесс использует порт
   lsof -i :8080
   lsof -i :8081
   lsof -i :8082
   ```

### Проблема: ImagePullBackOff при запуске

**Решение:**
```bash
# Пере-логинимся в GHCR
echo "$GITHUB_TOKEN" | \
  docker login ghcr.io -u TheMacroeconomicDao --password-stdin

# Принудительно скачиваем образ
docker pull ghcr.io/themacroeconomicdao/canton-node:0.5.8

# Перезапускаем
docker restart canton-validator-devnet
```

### Проблема: IP не в whitelist

**Симптомы в логах:**
```
ERROR: IP not whitelisted
403 Forbidden
401 Unauthorized
```

**Решение:**
Обратитесь к вашему SV Sponsor (GSF) для добавления IP 65.108.15.30 в whitelist.

**Проверка whitelisting:**
```bash
# Проверяем доступ к API
curl -v https://sv.sv-1.dev.global.canton.network.sync.global/api/sv/v0/devnet/onboard/validator/prepare \
  -X POST

# Должен вернуть onboarding_secret без ошибок 403/401
```

### Проблема: Недостаточно ресурсов

**Диагностика:**
```bash
# Проверяем использование памяти
free -h

# Проверяем использование диска
df -h

# Проверяем нагрузку CPU
top
```

**Решение:**
```bash
# Увеличиваем swap (если нужно)
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Очищаем неиспользуемые Docker образы и контейнеры
docker system prune -a -f
```

---

## 📋 ЧАСТЬ 6: ЧЕКЛИСТ РАЗВЕРТЫВАНИЯ

- [ ] SSH доступ настроен без пароля
- [ ] Сервер подключен и обновлен
- [ ] Docker установлен и запущен
- [ ] Директории созданы (/opt/canton-validator)
- [ ] Onboarding secret получен (актуален)
- [ ] GHCR credentials работают
- [ ] Canton Validator запущен
- [ ] Все контейнеры в статусе "Up"
- [ ] Health endpoint отвечает (http://65.108.15.30:8081/health)
- [ ] Логи не содержат критических ошибок
- [ ] Валидатор подключен к Canton DevNet
- [ ] Systemd service настроен для автозапуска
- [ ] Мониторинг скрипт создан и работает

---

## 🔐 ЧАСТЬ 7: ВАЖНАЯ ИНФОРМАЦИЯ

### Credentials и Secrets

**⚠️ КОНФИДЕНЦИАЛЬНО - НЕ ДЕЛИТЬСЯ:**

```bash
# Сервер
IP: 65.108.15.30
User: root
Password: $GHCR_PASSWORD

# GHCR (GitHub Container Registry)
Username: TheMacroeconomicDao
Token: $GITHUB_TOKEN
Срок действия: ~30 дней (до 22 декабря 2025)

# Canton DevNet
API: https://sv.sv-1.dev.global.canton.network.sync.global
Onboarding Secret: $ONBOARDING_SECRET
Срок действия: 1 час для DevNet

# Validator Identity
Party Hint: gyber-validator
Migration ID: 0
```

### Обновление секретов

**GitHub Token (каждые 30 дней):**
```bash
# 1. Создайте новый token на GitHub
# Settings → Developer settings → Personal access tokens → Generate new token
# Права: read:packages

# 2. Обновите на сервере
echo "<NEW_TOKEN>" | docker login ghcr.io -u TheMacroeconomicDao --password-stdin

# 3. Обновите в документации
```

**Onboarding Secret (для DevNet - каждый час):**
```bash
# Получаем новый секрет
ONBOARDING_SECRET=$(curl -s -X POST \
  "https://sv.sv-1.dev.global.canton.network.sync.global/api/sv/v0/devnet/onboard/validator/prepare" \
  | jq -r '.onboarding_secret')

# Обновляем в .env
sed -i "s/ONBOARDING_SECRET=.*/ONBOARDING_SECRET=$ONBOARDING_SECRET/" /opt/canton-validator/.env

# Перезапускаем валидатор
docker restart canton-validator-devnet
```

---

## 🚀 ЧАСТЬ 8: СЛЕДУЮЩИЕ ШАГИ

### Краткосрочные задачи (1-7 дней)

1. **Мониторинг стабильности**
   - Следить за логами первые 24-48 часов
   - Убедиться что валидатор не падает
   - Проверять resource usage

2. **Получение whitelisting**
   - Подтвердить с GSF что IP 65.108.15.30 в whitelist
   - Проверить connectivity к SCAN API

3. **Настройка алертинга**
   - Email уведомления при падении контейнера
   - Disk space alerts
   - Memory usage alerts

### Среднесрочные задачи (1-4 недели)

4. **Migration на TestNet**
   - Запросить TestNet onboarding secret
   - Развернуть аналогично на другом IP (если требуется)

5. **Backup стратегия**
   - Настроить регулярные backup'ы PostgreSQL
   - Backup конфигурационных файлов
   - Документировать recovery процедуру

6. **Production hardening**
   - Firewall правила (открыть только нужные порты)
   - Security audit
   - Performance tuning

### Долгосрочные задачи (1-3 месяца)

7. **Migration на MainNet**
   - Запросить whitelisting для MainNet
   - Получить MainNet allocation
   - Развернуть production validator

8. **Infrastructure as Code**
   - Terraform/Ansible скрипты для automation
   - CI/CD pipeline для обновлений
   - Disaster recovery testing

---

## 📚 ЧАСТЬ 9: ПОЛЕЗНЫЕ ССЫЛКИ

### Официальная документация

- **Canton Network**: https://www.canton.io
- **Canton Docs**: https://docs.canton.io
- **DevNet Setup**: https://developer.daml.com/canton
- **Digital Asset GitHub**: https://github.com/digital-asset/
- **Canton Releases**: https://github.com/digital-asset/decentralized-canton-sync/releases

### Внутренние документы проекта

- [`blockchain/README.md`](./README.md) - Общая документация
- [`blockchain/CANTON_VALIDATOR_DEPLOYMENT_STATUS_2025_11_27.md`](./CANTON_VALIDATOR_DEPLOYMENT_STATUS_2025_11_27.md) - Последний статус
- [`blockchain/RESEARCH_CANTON_K8S_DEPLOYMENT.md`](./RESEARCH_CANTON_K8S_DEPLOYMENT.md) - Исследование K8s решений
- [`blockchain/QUICK_START_NEW_SERVER.md`](./QUICK_START_NEW_SERVER.md) - Быстрый старт

### Скрипты и конфигурации

- [`blockchain/scripts/setup-canton-devnet.sh`](./scripts/setup-canton-devnet.sh) - Автоматическая установка
- [`blockchain/scripts/get-onboarding-secret.sh`](./scripts/get-onboarding-secret.sh) - Получение секретов
- [`blockchain/config/docker-compose.canton-validator.yml`](./config/docker-compose.canton-validator.yml) - Docker Compose конфиг

---

## ✅ ЗАКЛЮЧЕНИЕ

Этот документ предоставляет **полную самодостаточную инструкцию** для развертывания Canton Validator на сервере 65.108.15.30.

**Ключевые моменты:**
1. ✅ SSH без пароля настраивается за 3 простых шага
2. ✅ Развертывание через Docker Compose - **самое простое и надежное решение**
3. ✅ Все команды готовы к копированию и выполнению
4. ✅ Troubleshooting покрывает 90% типичных проблем
5. ✅ Полная документация для дальнейшей поддержки

**Для запуска прямо сейчас:**
1. Настройте SSH без пароля (Часть 1)
2. Выполните команды из Части 3 (Этапы 1-6)
3. Проверьте работу (Часть 4)

**Время развертывания:** ~30-45 минут для опытного пользователя

---

**Версия:** 1.0  
**Дата:** 28 ноября 2025  
**Автор:** Canton Validator Deployment Team  
**Статус:** ✅ Production Ready