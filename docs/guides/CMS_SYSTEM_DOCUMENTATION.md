# 🎛️ CMS System Documentation - Canton OTC Exchange

## 📋 Обзор

Система управления контентом (CMS) для Canton OTC Exchange позволяет администраторам изменять ключевые настройки платформы через веб-интерфейс с автоматическим применением изменений в продакшене.

## 🚀 Возможности

### ✅ **Автоматическое обновление настроек**
- Изменение цен на покупку/продажу Canton Coin
- Настройка лимитов торговли (мин/макс суммы)
- Обновление рабочих часов и контактной информации
- Автоматическое обновление GitHub секретов
- Автоматический запуск CI/CD пайплайна
- Zero-downtime деплой в продакшен

### 🔐 **Безопасность**
- Аутентификация через NextAuth v5
- Защищенные API endpoints
- Валидация всех входных данных
- Логирование всех изменений

## 🏗️ Архитектура

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Admin Panel   │───▶│  Settings API    │───▶│ GitHub Secrets  │
│   (React UI)    │    │  /api/admin/     │    │   (Storage)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │ GitHub Secrets   │───▶│   CI/CD         │
                       │      API         │    │   Pipeline      │
                       │ /api/admin/      │    │                 │
                       │ github-secrets   │    └─────────────────┘
                       └──────────────────┘             │
                                                        ▼
                                               ┌─────────────────┐
                                               │   Kubernetes    │
                                               │   Deployment    │
                                               │   (Production)  │
                                               └─────────────────┘
```

## 📁 Структура файлов

```
src/
├── app/
│   ├── api/admin/
│   │   ├── settings/route.ts          # Основной API настроек
│   │   └── github-secrets/route.ts    # GitHub секреты API
│   └── admin/
│       └── settings/
│           └── SettingsPageContent.tsx # UI компонент настроек
├── config/
│   └── otc.ts                         # Конфигурация OTC
└── lib/
    └── auth.ts                        # Аутентификация

.github/workflows/
└── deploy.yml                         # CI/CD пайплайн

k8s/
├── deployment.yaml                    # Kubernetes deployment
├── secret.template.yaml              # Шаблон секретов
└── ...

test-cms-system.js                    # Тестовый скрипт
```

## 🔧 API Endpoints

### GET `/api/admin/settings`
Получить текущие настройки системы.

**Ответ:**
```json
{
  "cantonCoinBuyPrice": 0.21,
  "cantonCoinSellPrice": 0.19,
  "minAmount": 1000,
  "maxAmount": 50000,
  "businessHours": "8:00 AM - 10:00 PM (GMT+8)",
  "supportedTokens": [...],
  "telegram": {
    "configured": true
  },
  "googleSheets": {
    "configured": true
  }
}
```

### PATCH `/api/admin/settings`
Обновить настройки системы.

**Запрос:**
```json
{
  "cantonCoinBuyPrice": 0.22,
  "cantonCoinSellPrice": 0.18,
  "minAmount": 500,
  "maxAmount": 100000
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "Settings updated successfully via GitHub secrets and deployment triggered!",
  "instructions": [
    "✅ Settings have been updated in GitHub secrets",
    "🚀 CI/CD pipeline has been triggered automatically",
    "⏱️ Deployment will complete in 5-10 minutes",
    "🌐 Changes will be live at https://1otc.cc after deployment"
  ]
}
```

### GET `/api/admin/github-secrets`
Получить информацию о управляемых GitHub секретах.

### PATCH `/api/admin/github-secrets`
Обновить GitHub секреты и запустить деплой.

### POST `/api/admin/github-secrets`
Запустить принудительный деплой.

## 🎯 Управляемые настройки

### 💰 **Цены Canton Coin**
- `CANTON_COIN_BUY_PRICE_USD` - Цена покупки Canton Coin
- `CANTON_COIN_SELL_PRICE_USD` - Цена продажи Canton Coin

### 📊 **Лимиты торговли**
- `MIN_USDT_AMOUNT` - Минимальная сумма в USDT
- `MAX_USDT_AMOUNT` - Максимальная сумма в USDT

### 🕐 **Рабочие часы**
- `BUSINESS_HOURS` - Рабочие часы OTC обменника

### 📧 **Контактная информация**
- `SUPPORT_EMAIL` - Email поддержки
- `TELEGRAM_BOT_USERNAME` - Username Telegram бота

## 🔄 Процесс обновления

1. **Администратор** изменяет настройки в админ панели
2. **API валидирует** входные данные
3. **GitHub Secrets API** обновляет секреты в GitHub
4. **CI/CD пайплайн** автоматически запускается
5. **Kubernetes deployment** обновляется с новыми переменными
6. **Изменения применяются** в продакшене (5-10 минут)

## 🧪 Тестирование

### Запуск тестов
```bash
# Установка зависимостей
npm install

# Запуск сервера разработки
npm run dev

# Запуск тестов CMS системы
node test-cms-system.js
```

### Тестовые сценарии
1. **Доступность админ панели** - проверка аутентификации
2. **API endpoints** - проверка всех API маршрутов
3. **Конфигурация OTC** - проверка загрузки настроек
4. **Обновление настроек** - симуляция изменения цен
5. **GitHub интеграция** - проверка API секретов
6. **CI/CD пайплайн** - проверка конфигурации
7. **Kubernetes** - проверка deployment конфигурации

## 🚀 Развертывание

### Предварительные требования
- Node.js 20+
- Kubernetes кластер
- GitHub репозиторий с настроенными секретами
- Docker registry (GitHub Container Registry)

### Настройка GitHub секретов
```bash
# Основные настройки
CANTON_COIN_BUY_PRICE_USD=0.21
CANTON_COIN_SELL_PRICE_USD=0.19
MIN_USDT_AMOUNT=1000
MAX_USDT_AMOUNT=50000

# Контактная информация
BUSINESS_HOURS="8:00 AM - 10:00 PM (GMT+8)"
SUPPORT_EMAIL=support@canton-otc.com
TELEGRAM_BOT_USERNAME=@canton_otc_bot

# Интеграции
GOOGLE_SHEET_ID=your_sheet_id
TELEGRAM_BOT_TOKEN=your_bot_token
# ... другие секреты
```

### Развертывание
```bash
# Клонирование репозитория
git clone https://github.com/TheMacroeconomicDao/CantonOTC.git
cd CantonOTC

# Установка зависимостей
npm install

# Настройка переменных окружения
cp env.template .env.local
# Заполните .env.local

# Запуск в продакшене
npm run build
npm start
```

## 📊 Мониторинг

### GitHub Actions
- **URL:** https://github.com/TheMacroeconomicDao/CantonOTC/actions
- **Мониторинг:** Security → Build → Deploy
- **Время деплоя:** 5-10 минут

### Kubernetes
```bash
# Проверка статуса deployment
kubectl get pods -n canton-otc

# Логи приложения
kubectl logs -f deployment/canton-otc -n canton-otc

# Описание deployment
kubectl describe deployment canton-otc -n canton-otc
```

### Продакшен
- **URL:** https://1otc.cc
- **Health check:** https://1otc.cc/api/health
- **Админ панель:** https://1otc.cc/admin

## 🔧 Устранение неполадок

### Проблема: Настройки не применяются
**Решение:**
1. Проверьте логи CI/CD пайплайна в GitHub Actions
2. Убедитесь что GitHub секреты обновлены
3. Проверьте статус Kubernetes deployment
4. Перезапустите deployment при необходимости

### Проблема: Ошибка аутентификации
**Решение:**
1. Проверьте настройки NextAuth в `.env.local`
2. Убедитесь что `ADMIN_EMAIL` и `ADMIN_PASSWORD_HASH` настроены
3. Проверьте сессию в браузере

### Проблема: CI/CD пайплайн не запускается
**Решение:**
1. Проверьте права доступа к GitHub репозиторию
2. Убедитесь что `GITHUB_TOKEN` настроен
3. Проверьте конфигурацию workflow в `.github/workflows/deploy.yml`

## 📈 Будущие улучшения

### Планируемые функции
- [ ] **База данных настроек** - хранение настроек в PostgreSQL
- [ ] **Версионирование** - история изменений настроек
- [ ] **A/B тестирование** - тестирование разных цен
- [ ] **Уведомления** - Slack/Telegram уведомления об изменениях
- [ ] **Аналитика** - отслеживание влияния изменений цен
- [ ] **Backup/Restore** - резервное копирование настроек

### Технические улучшения
- [ ] **Rate limiting** - ограничение частоты изменений
- [ ] **Audit log** - детальное логирование всех действий
- [ ] **Multi-environment** - поддержка staging/production
- [ ] **Real-time updates** - WebSocket для мгновенных обновлений
- [ ] **API versioning** - версионирование API

## 📞 Поддержка

### Контакты
- **Email:** support@canton-otc.com
- **Telegram:** @canton_otc_bot
- **GitHub:** https://github.com/TheMacroeconomicDao/CantonOTC

### Документация
- **API Docs:** https://1otc.cc/api/health
- **Admin Panel:** https://1otc.cc/admin
- **GitHub Actions:** https://github.com/TheMacroeconomicDao/CantonOTC/actions

---

**🎉 CMS система готова к использованию!**

Все изменения в админ панели автоматически применяются в продакшене через GitHub секреты и CI/CD пайплайн.

