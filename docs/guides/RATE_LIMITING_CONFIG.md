# 🛡️ Rate Limiting & Anti-Spam Configuration

## Rate Limiting Variables

### Order Creation Limits
- `RATE_LIMIT_ORDER_POINTS` - Количество заказов (по умолчанию: 3)
- `RATE_LIMIT_ORDER_DURATION` - Период в секундах (по умолчанию: 3600 = 1 час)
- `RATE_LIMIT_ORDER_BLOCK` - Время блокировки в секундах (по умолчанию: 3600 = 1 час)

### IP Limits
- `RATE_LIMIT_IP_POINTS` - Количество запросов (по умолчанию: 100)
- `RATE_LIMIT_IP_DURATION` - Период в секундах (по умолчанию: 900 = 15 минут)
- `RATE_LIMIT_IP_BLOCK` - Время блокировки в секундах (по умолчанию: 300 = 5 минут)

### Email Limits
- `RATE_LIMIT_EMAIL_POINTS` - Количество заказов на email (по умолчанию: 5)
- `RATE_LIMIT_EMAIL_DURATION` - Период в секундах (по умолчанию: 86400 = 24 часа)
- `RATE_LIMIT_EMAIL_BLOCK` - Время блокировки в секундах (по умолчанию: 43200 = 12 часов)

## Anti-Spam Variables

### Main Control
- `ENABLE_ANTI_SPAM` - Включить/выключить anti-spam (по умолчанию: true, установить false для отключения)

### Timing Configuration
- `ANTI_SPAM_DUPLICATE_WINDOW` - Окно для детекции дублирующихся сумм в миллисекундах (по умолчанию: 300000 = 5 минут)
- `ANTI_SPAM_RAPID_WINDOW` - Окно для детекции быстрых заявок в миллисекундах (по умолчанию: 60000 = 1 минута)
- `ANTI_SPAM_MAX_ORDERS` - Максимальное количество заказов в окне (по умолчанию: 3)
- `ANTI_SPAM_BLOCK_DURATION` - Время блокировки в миллисекундах (по умолчанию: 1800000 = 30 минут)
- `ANTI_SPAM_CLEANUP_INTERVAL` - Интервал очистки в миллисекундах (по умолчанию: 600000 = 10 минут)

## Примеры конфигурации

### Для тестирования (отключить все ограничения)
```bash
# Rate limiting - очень высокие лимиты
RATE_LIMIT_ORDER_POINTS=1000
RATE_LIMIT_ORDER_DURATION=1
RATE_LIMIT_IP_POINTS=10000
RATE_LIMIT_IP_DURATION=1
RATE_LIMIT_EMAIL_POINTS=1000
RATE_LIMIT_EMAIL_DURATION=1

# Anti-spam - отключить
ENABLE_ANTI_SPAM=false
```

### Для production (строгие ограничения)
```bash
# Rate limiting - строгие лимиты
RATE_LIMIT_ORDER_POINTS=3
RATE_LIMIT_ORDER_DURATION=3600
RATE_LIMIT_IP_POINTS=100
RATE_LIMIT_IP_DURATION=900
RATE_LIMIT_EMAIL_POINTS=5
RATE_LIMIT_EMAIL_DURATION=86400

# Anti-spam - включить
ENABLE_ANTI_SPAM=true
ANTI_SPAM_DUPLICATE_WINDOW=300000
ANTI_SPAM_RAPID_WINDOW=60000
ANTI_SPAM_MAX_ORDERS=3
ANTI_SPAM_BLOCK_DURATION=1800000
```

### Для разработки (мягкие ограничения)
```bash
# Rate limiting - мягкие лимиты
RATE_LIMIT_ORDER_POINTS=10
RATE_LIMIT_ORDER_DURATION=3600
RATE_LIMIT_IP_POINTS=500
RATE_LIMIT_IP_DURATION=900
RATE_LIMIT_EMAIL_POINTS=20
RATE_LIMIT_EMAIL_DURATION=86400

# Anti-spam - включить с мягкими настройками
ENABLE_ANTI_SPAM=true
ANTI_SPAM_DUPLICATE_WINDOW=600000
ANTI_SPAM_RAPID_WINDOW=120000
ANTI_SPAM_MAX_ORDERS=10
ANTI_SPAM_BLOCK_DURATION=300000
```

## Добавление в GitHub Secrets

Добавьте эти переменные в GitHub Secrets для автоматического деплоя:

1. Перейдите в Settings → Secrets and variables → Actions
2. Добавьте новые repository secrets:

```
RATE_LIMIT_ORDER_POINTS=1000
RATE_LIMIT_ORDER_DURATION=1
RATE_LIMIT_IP_POINTS=10000
RATE_LIMIT_IP_DURATION=1
RATE_LIMIT_EMAIL_POINTS=1000
RATE_LIMIT_EMAIL_DURATION=1
ENABLE_ANTI_SPAM=false
```

## Обновление Kubernetes Secrets

После добавления в GitHub Secrets, обновите Kubernetes secret:

```bash
kubectl create secret generic canton-otc-secrets \
  --from-literal=RATE_LIMIT_ORDER_POINTS=1000 \
  --from-literal=RATE_LIMIT_ORDER_DURATION=1 \
  --from-literal=RATE_LIMIT_IP_POINTS=10000 \
  --from-literal=RATE_LIMIT_IP_DURATION=1 \
  --from-literal=RATE_LIMIT_EMAIL_POINTS=1000 \
  --from-literal=RATE_LIMIT_EMAIL_DURATION=1 \
  --from-literal=ENABLE_ANTI_SPAM=false \
  --dry-run=client -o yaml | kubectl apply -f -
```

