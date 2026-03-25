# ⚙️ Конфигурация проекта Canton OTC

Эта папка содержит все конфигурационные файлы проекта.

## 📁 Структура

### 🐳 `docker/` - Docker конфигурация
- Dockerfile для продакшна
- Dockerfile для разработки
- Оптимизированные образы

### ☸️ `kubernetes/` - Kubernetes конфигурация
- Манифесты для деплоя
- Конфигурация сервисов
- Настройки ingress и secrets

### 🔧 `github/` - GitHub конфигурация
- Workflow файлы
- Настройки CI/CD
- Конфигурация Actions

### 📄 Корневые конфигурации
- fin-configuration.json - Конфигурация FIN Assistant
- fin-assistant-logo.svg - Логотип FIN Assistant

## 🚀 Использование

### Docker
```bash
# Сборка образа
docker build -f config/docker/Dockerfile -t canton-otc .

# Сборка оптимизированного образа
docker build -f config/docker/Dockerfile.optimized -t canton-otc:optimized .
```

### Kubernetes
```bash
# Применение манифестов
kubectl apply -f config/kubernetes/

# Проверка статуса
kubectl get pods -n canton-otc
```

### GitHub Actions
```bash
# Workflow файлы автоматически используются GitHub
# При изменении секретов запускается деплой
```

## ⚠️ Важно

- Не коммитьте секреты в репозиторий
- Используйте переменные окружения для чувствительных данных
- Тестируйте конфигурации в dev-окружении
- Документируйте изменения в конфигурации
