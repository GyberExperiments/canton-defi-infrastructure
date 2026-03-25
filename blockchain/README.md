# Canton Validator Node

Полная настройка и управление Canton Validator Node для участия в децентрализованной сети Canton Network.

**Версия Canton**: 0.5.3  
**Статус**: Production Ready ✅  
**Последнее обновление**: 2025-11-29

---

## 🚀 Быстрый старт

### Вариант 1: Развертывание через Kubernetes (k3s)

Проект использует Kubernetes для управления валидаторами и валидации IP адресов.

```bash
# Подключение ноды к k3s кластеру
./scripts/connect-all-ips-to-cluster.sh

# Развертывание валидатора
kubectl apply -f k8s/canton-validator-full-stack.yaml
```

### Вариант 2: Развертывание на сервере (Docker Compose)

```bash
# Автоматическая установка для DevNet
./scripts/setup-canton-devnet.sh

# Или ручная установка
./scripts/get-onboarding-secret.sh devnet --save
cd /opt/canton-validator
docker compose up -d
```

### Вариант 3: Использование кастомного Docker образа

```bash
# Сборка образа валидатора
cd validator-image
docker build -t canton-validator:0.5.3 .

# Запуск с переменными окружения
docker run -d \
  -e CANTON_API=https://sv.sv-1.dev.global.canton.network.sync.global \
  -e ONBOARDING_SECRET=your_secret \
  -e PARTY_HINT=gyber-validator \
  -e VALIDATOR_MODE=0 \
  canton-validator:0.5.3
```

---

## 📁 Структура проекта

```
blockchain/
├── validator-image/          # Docker образ валидатора
│   ├── Dockerfile           # Образ с Canton 0.5.3
│   └── entrypoint.sh        # Скрипт запуска
├── k8s/                     # Kubernetes манифесты
│   ├── canton-validator-full-stack.yaml
│   ├── ip-validation-mainnet.yaml
│   ├── ip-validation-testnet.yaml
│   └── get-onboarding-secret-job.yaml
├── scripts/                 # Скрипты автоматизации
│   ├── deploy-canton-validator.sh
│   ├── get-onboarding-secret.sh
│   ├── validate-testnet-ip.sh
│   ├── validate-mainnet-ip.sh
│   ├── connect-all-ips-to-cluster.sh
│   └── ...
├── config/                  # Конфигурационные файлы
│   ├── canton.conf
│   ├── validator.conf
│   └── docker-compose.canton-validator.yml
├── docs/                    # Документация
└── nginx.conf              # Конфигурация Nginx для Web UI
```

---

## 🌐 Сети и IP адреса

### DevNet (Разработка)
- **IP адрес**: 65.108.15.30
- **API**: `https://sv.sv-1.dev.global.canton.network.sync.global`
- **Scan API**: `https://scan.sv-1.dev.global.canton.network.sync.global`
- **Секрет**: Действует 1 час (автоматически обновляется)
- **Статус**: ✅ Развернут и работает

### TestNet (Тестирование)
- **IP адрес**: 65.108.15.20
- **API**: `https://sv.sv-1.testnet.global.canton.network.sync.global`
- **Scan API**: `https://scan.sv-1.testnet.global.canton.network.sync.global`
- **Секрет**: Долгосрочный (от SV sponsor)
- **Статус**: ⏳ Частично валидирован (IP настроен, ожидается whitelisting)

### MainNet (Продакшн)
- **IP адрес**: 65.108.15.19
- **API**: `https://sv.sv-1.global.canton.network.sync.global`
- **Scan API**: `https://scan.sv-1.global.canton.network.sync.global`
- **Секрет**: По запросу от SV sponsor
- **Статус**: ✅ Полностью валидирован (15 Sequencer endpoints доступны)

---

## 🔍 Валидация IP адресов

Проект включает автоматическую валидацию IP адресов для Testnet и Mainnet через Kubernetes Jobs.

### Проверка Mainnet IP (65.108.15.19)

```bash
# Удалить предыдущий Job
kubectl delete job ip-validation-checker-mainnet -n default --ignore-not-found=true

# Запустить проверку
kubectl apply -f k8s/ip-validation-mainnet.yaml

# Получить результаты
kubectl logs -l job-name=ip-validation-checker-mainnet -n default
```

**Текущий статус Mainnet**: ✅ Валидирован (15 Sequencer endpoints)

### Проверка Testnet IP (65.108.15.20)

```bash
# Удалить предыдущий Job
kubectl delete job ip-validation-checker-testnet -n default --ignore-not-found=true

# Запустить проверку
kubectl apply -f k8s/ip-validation-testnet.yaml

# Получить результаты
kubectl logs -l job-name=ip-validation-checker-testnet -n default
```

**Текущий статус Testnet**: ⏳ Частично валидирован (ожидается whitelisting)

Подробные отчеты: [`TESTNET_MAINNET_VALIDATION_REPORT.md`](TESTNET_MAINNET_VALIDATION_REPORT.md)

---

## 🛠️ Основные команды

### Управление валидатором

```bash
# Запуск валидатора (Docker Compose)
cd /opt/canton-validator
docker compose up -d

# Остановка валидатора
docker compose down

# Проверка статуса
docker compose ps

# Просмотр логов
docker compose logs -f participant validator
```

### Получение onboarding secrets

```bash
# DevNet (действует 1 час)
./scripts/get-onboarding-secret.sh devnet --save

# TestNet
./scripts/get-onboarding-secret.sh testnet --save

# MainNet
./scripts/get-onboarding-secret.sh mainnet --save
```

### Kubernetes команды

```bash
# Статус валидатора
kubectl get pods -l app=canton-validator

# Логи валидатора
kubectl logs -l app=canton-validator -f

# Проверка IP валидации
kubectl get jobs -n default | grep ip-validation
```

---

## 📊 Мониторинг

### Endpoints

- **Health Check**: `http://localhost:8081/health`
- **Metrics**: `http://localhost:8080/metrics`
- **Admin API**: `http://localhost:8082/admin`
- **Wallet Web UI**: `http://localhost/wallet`
- **ANS Web UI**: `http://localhost/ans`

### Логи

```bash
# Docker Compose
docker compose logs -f participant validator

# Kubernetes
kubectl logs -l app=canton-validator -f

# Последние 100 строк
docker compose logs --tail=100 participant
```

---

## 🔧 Конфигурация

### Основные параметры

| Параметр | Описание | Значение |
|----------|----------|----------|
| `CANTON_VERSION` | Версия Canton | **0.5.3** |
| `VALIDATOR_NAME` | Имя валидатора | gyber-validator |
| `PARTY_HINT` | Идентификатор party | gyber-validator-participant |
| `VALIDATOR_MODE` | Режим (0=validator, 1=observer) | 0 |
| `ONBOARDING_SECRET` | Секрет подключения | Получается через API |

### Переменные окружения

Обязательные переменные для запуска валидатора:

```bash
CANTON_API=https://sv.sv-1.dev.global.canton.network.sync.global
ONBOARDING_SECRET=your_secret_here
PARTY_HINT=gyber-validator-participant
VALIDATOR_MODE=0
```

Для аутентификации (опционально):

```bash
AUTH_URL=http://65.108.15.30:32233
AUTH_JWKS_URL=http://65.108.15.30:32233/jwks
AUTH_WELLKNOWN_URL=http://65.108.15.30:32233/.well-known/openid-configuration
SPLICE_APP_PARTICIPANT_AUTH_AUDIENCE=authenticated
SPLICE_APP_PARTICIPANT_AUTH_JWKS_URL=http://65.108.15.30:32233/jwks
```

---

## 🏗️ Архитектура

### Компоненты системы

1. **Canton Validator** - основной валидатор сети
   - Контейнер: `validator`
   - Порт: 6865 (P2P)

2. **Canton Participant** - участник сети
   - Контейнер: `participant`
   - Порты: 8080 (HTTP), 8081 (Health), 8082 (Admin API)

3. **PostgreSQL** - база данных
   - Контейнер: `postgres-splice`
   - Порт: 5432

4. **Nginx** - reverse proxy для Web UI
   - Контейнер: `nginx`
   - Порт: 80

5. **Web UI** - веб-интерфейсы
   - `wallet-web-ui` - кошелек
   - `ans-web-ui` - ANS (Asset Name Service)

### Docker-in-Docker

Валидатор использует Docker-in-Docker подход:
- Основной контейнер содержит Docker CLI и docker-compose
- Внутри запускается docker-compose stack с валидатором
- Это позволяет использовать стандартные образы Canton без изменений

---

## 🔒 Безопасность

### Важные файлы

```bash
# Исключить из git
config/onboarding-secrets.env
*.env
.env.*
data/
logs/
backups/
```

### Права доступа

```bash
# Установка правильных прав
chmod +x scripts/*.sh
chmod 600 config/onboarding-secrets.env
```

### Аутентификация

Проект интегрирован с Supabase для OIDC аутентификации:
- JWKS endpoint: `http://65.108.15.30:32233/jwks`
- Discovery endpoint: `http://65.108.15.30:32233/.well-known/openid-configuration`

---

## 🚨 Устранение неполадок

### Частые проблемы

1. **Контейнеры не запускаются**
   ```bash
   # Проверка логов
   docker compose logs
   
   # Проверка конфигурации
   docker compose config
   
   # Пересоздание контейнеров
   docker compose down && docker compose up -d
   ```

2. **Ошибка подключения к API**
   ```bash
   # Проверка интернет-соединения
   curl -I https://scan.sv-1.dev.global.canton.network.sync.global
   
   # Проверка IP валидации
   kubectl apply -f k8s/ip-validation-mainnet.yaml
   ```

3. **Проблемы с портами**
   ```bash
   # Проверка занятых портов
   lsof -i :8080
   lsof -i :8081
   lsof -i :8082
   lsof -i :6865
   ```

4. **Ошибка postgres-entrypoint**
   - Уже исправлено в Dockerfile (удален проблемный bind mount)
   - Если возникает, проверьте версию образа (должна быть 0.5.3)

### Диагностика

```bash
# Статус всех контейнеров
docker compose ps

# Проверка здоровья
curl http://localhost:8081/health

# Проверка подключения к сети
docker compose logs participant | grep -i "reconnect\|synchronizer"

# Проверка версии
docker compose exec validator cat /opt/VERSION
```

---

## 📈 Производительность

### Системные требования

- **RAM**: минимум 4GB, рекомендуется 8GB+
- **CPU**: минимум 2 ядра, рекомендуется 4+ ядра
- **Диск**: минимум 50GB свободного места (SSD рекомендуется)
- **Сеть**: стабильное соединение, фиксированный IP адрес

### Оптимизация

```bash
# Мониторинг ресурсов
docker stats

# Системные метрики
htop
iotop

# Логи производительности
docker compose logs participant | grep -i "performance\|gc\|memory"
```

---

## 📚 Документация

### Внутренняя документация

- [`TESTNET_MAINNET_VALIDATION_REPORT.md`](TESTNET_MAINNET_VALIDATION_REPORT.md) - Отчет о валидации IP адресов
- [`FINAL_CANTON_VALIDATOR_DEPLOYMENT_REPORT.md`](FINAL_CANTON_VALIDATOR_DEPLOYMENT_REPORT.md) - Полный отчет о развертывании
- [`CANTON_VALIDATOR_UPDATE_TO_0.5.3_REPORT.md`](CANTON_VALIDATOR_UPDATE_TO_0.5.3_REPORT.md) - Отчет об обновлении до 0.5.3
- [`PROMPT_VALIDATE_MAINNET_IP.md`](PROMPT_VALIDATE_MAINNET_IP.md) - Инструкции по валидации Mainnet IP
- [`PROMPT_VALIDATE_TESTNET_IP.md`](PROMPT_VALIDATE_TESTNET_IP.md) - Инструкции по валидации Testnet IP

### Внешние ресурсы

- [Официальная документация Canton](https://sync.global/docs/)
- [GitHub репозиторий](https://github.com/digital-asset/decentralized-canton-sync)
- [Canton Network Explorer](https://scan.sv-1.global.canton.network.sync.global)

---

## 🤝 Поддержка

### Контакты

- **SV Sponsor**: [Ваш спонсор Super Validator]
- **Technical Support**: [Поддержка]
- **Emergency Contact**: [Экстренная связь]

### Полезные ссылки

- [Discord сообщество](https://discord.gg/canton)
- [Telegram канал](https://t.me/canton_network)
- [Twitter](https://twitter.com/canton_network)

---

## 📝 Changelog

### 2025-11-29
- ✅ Обновлен README с актуальной информацией
- ✅ Добавлена информация о валидации IP адресов
- ✅ Обновлена версия Canton до 0.5.3

### 2025-11-28
- ✅ Обновление Canton Validator до версии 0.5.3
- ✅ Исправление проблемы postgres-entrypoint
- ✅ Настройка аутентификации через Supabase

### 2025-11-27
- ✅ Развертывание валидатора на DevNet
- ✅ Настройка Kubernetes кластера
- ✅ Валидация IP адресов для Testnet и Mainnet

---

## 📝 Лицензия

Этот проект использует MIT лицензию. См. файл [LICENSE](../LICENSE) для подробностей.

---

**Версия проекта**: 2.0  
**Версия Canton**: 0.5.3  
**Дата обновления**: 2025-11-29  
**Автор**: Gyber  
**Статус**: Production Ready ✅
