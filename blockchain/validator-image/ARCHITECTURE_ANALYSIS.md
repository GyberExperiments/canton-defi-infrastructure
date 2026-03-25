# 🏗️ АНАЛИЗ АРХИТЕКТУРЫ: Почему Docker-in-Docker и как это исправить

## ❌ ТЕКУЩАЯ ПРОБЛЕМА

### Почему используется Docker-in-Docker?

Образ `canton-node:0.5.8` - это **wrapper для Docker Compose**, а не самостоятельное приложение:

```bash
# Внутри образа выполняется:
/opt/canton/start.sh → docker compose -f compose.yaml up -d
```

Это создает стек из 6 сервисов:
1. PostgreSQL (postgres:14)
2. Canton Participant (canton-participant:0.5.8)
3. Validator App (validator-app:0.5.8)
4. Wallet Web UI (wallet-web-ui:0.5.8)
5. ANS Web UI (ans-web-ui:0.5.8)
6. Nginx (reverse proxy)

### Проблемы Docker-in-Docker:

1. **Bind mount не работает** - Docker daemon ищет файлы на хосте, а не в контейнере
2. **Security риски** - требуется privileged режим
3. **Сложность в Kubernetes** - нужен DinD sidecar или host socket
4. **Performance overhead** - дополнительный слой абстракции
5. **Проблемы с volumes** - сложность управления данными

---

## ✅ ПРАВИЛЬНЫЕ РЕШЕНИЯ

### Вариант 1: Запуск напрямую на хосте (РЕКОМЕНДУЕТСЯ)

**Лучшее решение для production** - запустить Docker Compose напрямую на сервере:

```bash
# На сервере 65.108.15.30
cd /opt/canton-validator
docker compose -f compose.yaml up -d
```

**Преимущества:**
- ✅ Нет Docker-in-Docker
- ✅ Простая архитектура
- ✅ Нативная работа Docker Compose
- ✅ Легкий мониторинг и troubleshooting
- ✅ Нет проблем с bind mount

**Systemd service:**
```ini
[Unit]
Description=Canton Validator
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/canton-validator
EnvironmentFile=/opt/canton-validator/.env
ExecStart=/usr/bin/docker compose -f compose.yaml up -d
ExecStop=/usr/bin/docker compose -f compose.yaml down
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Вариант 2: Использование host Docker socket в Kubernetes

Монтировать `/var/run/docker.sock` с хоста в Pod:

```yaml
spec:
  containers:
  - name: canton-validator
    image: ghcr.io/themacroeconomicdao/canton-node:0.5.8
    volumeMounts:
    - name: docker-sock
      mountPath: /var/run/docker.sock
  volumes:
  - name: docker-sock
    hostPath:
      path: /var/run/docker.sock
      type: Socket
```

**⚠️ Security warning:** Контейнер получает полный доступ к Docker daemon хоста!

### Вариант 3: Конвертация compose.yaml в K8s манифесты

Использовать `kompose` для конвертации:

```bash
# Извлечь compose.yaml из образа
docker run --rm ghcr.io/themacroeconomicdao/canton-node:0.5.8 \
  cat /opt/canton/compose.yaml > canton-compose.yaml

# Конвертировать в K8s
kompose convert -f canton-compose.yaml
```

**Проблема:** Отдельные образы `canton-participant:0.5.8` и `validator-app:0.5.8` **НЕ доступны** в GHCR!

---

## 🎯 РЕКОМЕНДАЦИЯ

**Для production на сервере 65.108.15.30:**

1. **Запустить напрямую через systemd** (Вариант 1) - самое простое и надежное решение
2. **Убрать Docker-in-Docker** из архитектуры
3. **Использовать host Docker daemon** напрямую

**Для Kubernetes (если обязательно нужно):**

1. Использовать host Docker socket (Вариант 2) с ограничениями безопасности
2. Или найти официальные Canton Helm charts от Digital Asset
3. Или конвертировать compose.yaml в K8s манифесты (если образы доступны)

---

## 🔧 ИСПРАВЛЕНИЕ ТЕКУЩЕЙ ПРОБЛЕМЫ

Проблема с `postgres-entrypoint.sh` возникает из-за Docker-in-Docker:

**Root cause:** Docker daemon на хосте не может найти файл `/opt/canton/postgres-entrypoint.sh`, который существует только внутри контейнера `canton-validator`.

**Решение в Dockerfile:**
- Убрать bind mount для `postgres-entrypoint.sh`
- Использовать стандартный postgres entrypoint
- Или создать кастомный postgres образ с встроенным entrypoint

**Но лучше:** Убрать Docker-in-Docker полностью и запустить на хосте!

---

**Дата:** 28 ноября 2025  
**Статус:** Анализ завершен  
**Рекомендация:** Запуск на хосте через systemd
