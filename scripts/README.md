# 🛠️ Скрипты проекта Canton OTC

Эта папка содержит все скрипты для автоматизации задач проекта.

## 📁 Структура

### ⚙️ `setup/` - Скрипты настройки
- Настройка GitHub Secrets
- Конфигурация Kubernetes
- Установка зависимостей
- Генерация секретов

### 🚀 `deployment/` - Скрипты развертывания
- Деплой в Kubernetes
- Обновление контейнеров
- Настройка CI/CD
- Мониторинг деплоя

### 📊 `monitoring/` - Скрипты мониторинга
- Проверка состояния сервисов
- Мониторинг производительности
- Алерты и уведомления

## 🚀 Использование

### Настройка проекта
```bash
# Настройка GitHub Secrets
./scripts/setup/setup-github-secrets.sh

# Генерация секретов
./scripts/setup/generate-secrets.sh

# Настройка Kubernetes
./scripts/setup/setup-kubectl-secret.sh
```

### Развертывание
```bash
# Деплой приложения
./scripts/deployment/monitor-deployment.sh

# Обновление контейнеров
./scripts/deployment/add-ghcr-token.py
```

### Мониторинг
```bash
# Проверка состояния
./scripts/monitoring/check-intercom-api.js
```

## ⚠️ Важно

- Все скрипты должны быть исполняемыми (`chmod +x`)
- Проверяйте переменные окружения перед запуском
- Логируйте выполнение скриптов
- Тестируйте скрипты в dev-окружении
