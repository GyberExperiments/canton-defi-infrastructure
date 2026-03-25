# 🔧 ПРОМПТ: Устранение проблем с Telegram Client API и деплоем

## 📋 КОНТЕКСТ ПРОЕКТА

**Проект**: Canton OTC Exchange  
**Репозиторий**: https://github.com/TheMacroeconomicDao/CantonOTC  
**Production**: https://1otc.cc  
**Namespace**: `canton-otc`  
**Ветка**: `main`

**Архитектура**:
- Next.js 15.5.7 (App Router)
- Kubernetes на production
- GitHub Actions для CI/CD
- GitHub Container Registry (ghcr.io)
- Secrets хранятся в GitHub Secrets и синхронизируются в Kubernetes Secret

---

## ⚠️ ТЕКУЩИЕ ПРОБЛЕМЫ

### Проблема 1: Telegram Client API не инициализируется
**Симптомы**:
- В логах: `⚠️ Telegram Client API configuration missing. Service will be disabled.`
- При принятии заявки: `Telegram Client API not available, will use Bot API fallback`
- Переменные окружения `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION_STRING` отсутствуют в runtime подов

**Что сделано**:
- ✅ Секреты добавлены в GitHub Secrets
- ✅ Секреты добавлены в Kubernetes Secret `canton-otc-secrets`
- ✅ Deployment обновлен (env vars добавлены, без `optional: true`)
- ✅ Workflow обновлен для синхронизации секретов

**Текущее состояние**:
- Secret содержит только 21 ключ из ~50+ требуемых
- Работающие поды используют старый образ `22ddb0a3` (не `c3d41e2c`)
- Новые поды не запускаются: `CreateContainerConfigError` (отсутствуют ключи в Secret)

### Проблема 2: Deployment не обновляется на последнюю версию
**Симптомы**:
- Deployment указывает на образ `c3d41e2c`
- Работающие поды используют старый образ `22ddb0a3`
- Rollout timeout при обновлении

**Причина**: Новые поды не могут запуститься из-за неполного Secret

### Проблема 3: Workflow обновляет Secret не полностью
**Симптомы**:
- Workflow успешно обновляет Secret
- Но только часть ключей попадает в Secret (21 из ~50+)
- Отсутствуют ключи: `GOOGLE_SHEET_ID`, `ADMIN_EMAIL`, `ANTI_SPAM_*`, и др.

---

## 🎯 ЗАДАЧА

**Проанализировать архитектуру проекта и устранить проблемы, найдя их реальные причины:**

1. **Почему Secret не обновляется полностью?**
   - Проверить workflow `.github/workflows/deploy.yml`
   - Проверить `config/kubernetes/k8s/secret.template.yaml`
   - Убедиться что все секреты из template попадают в workflow

2. **Почему поды не обновляются на последнюю версию?**
   - Проверить стратегию rollout в deployment
   - Проверить почему новые поды не могут запуститься
   - Убедиться что все обязательные ключи есть в Secret или помечены как optional

3. **Почему переменные Telegram Client API не попадают в поды?**
   - Проверить deployment.yaml - правильно ли настроены env vars
   - Проверить что Secret содержит все нужные ключи
   - Убедиться что поды перезапускаются после обновления Secret

---

## 📁 КЛЮЧЕВЫЕ ФАЙЛЫ ДЛЯ АНАЛИЗА

1. `.github/workflows/deploy.yml` - основной workflow для production
2. `config/kubernetes/k8s/deployment.yaml` - конфигурация deployment
3. `config/kubernetes/k8s/secret.template.yaml` - шаблон Secret
4. `src/lib/services/telegramClient.ts` - сервис Telegram Client API
5. `src/lib/services/telegramMediator.ts` - интеграция с mediator

---

## 🔍 ЧТО НУЖНО СДЕЛАТЬ

### Шаг 1: Анализ
1. Прочитать все ключевые файлы
2. Понять архитектуру синхронизации секретов
3. Найти реальную причину почему Secret неполный
4. Найти реальную причину почему поды не обновляются

### Шаг 2: Исправление
1. Исправить workflow чтобы он обновлял ВСЕ секреты из template
2. Убедиться что все секреты есть в GitHub Secrets или помечены как optional
3. Исправить deployment если нужно (добавить optional для необязательных ключей)
4. Убедиться что rollout strategy правильная

### Шаг 3: Верификация
1. Проверить что Secret содержит все нужные ключи
2. Проверить что новые поды запускаются
3. Проверить что переменные Telegram Client API попадают в поды
4. Проверить что Telegram Client API инициализируется

---

## 🛠️ ТРЕБОВАНИЯ К РЕШЕНИЮ

1. **Best Practices**:
   - Использовать industry-standard подходы
   - Не создавать временные решения
   - Учитывать архитектуру проекта

2. **Безопасность**:
   - Секреты должны храниться в GitHub Secrets
   - Синхронизация через CI/CD workflow
   - Не коммитить секреты в код

3. **Надежность**:
   - Rollout должен быть безопасным (RollingUpdate)
   - Поды должны иметь все необходимые переменные
   - Fallback механизмы должны работать

4. **Документация**:
   - Объяснить что было исправлено и почему
   - Указать реальные причины проблем

---

## 📊 ТЕКУЩЕЕ СОСТОЯНИЕ

**Коммит**: `c3d41e2c`  
**Образ**: `ghcr.io/themacroeconomicdao/cantonotc:c3d41e2c`  
**Deployment образ**: `ghcr.io/themacroeconomicdao/cantonotc:c3d41e2c`  
**Работающие поды**: используют образ `22ddb0a3` (старый)  
**Secret ключей**: 21 из ~50+  
**Telegram Client API**: не инициализируется

**Тестовая заявка**: `MJDQOKA7-JA78U1` (создана, отправлена в группу клиентов)

---

## 🎯 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После исправления:
1. ✅ Secret содержит все необходимые ключи
2. ✅ Новые поды запускаются с последней версией образа
3. ✅ Переменные `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION_STRING` доступны в runtime
4. ✅ Telegram Client API инициализируется при старте: `📱 Telegram Client Service Config: { hasApiId: true, hasApiHash: true, hasSession: true }`
5. ✅ При принятии заявки отправляется уведомление через Telegram Client API: `✅ Taker notified via Telegram Client API`

---

## 📝 ИНСТРУКЦИИ ДЛЯ AI

1. **Прочитай все ключевые файлы** перед тем как делать выводы
2. **Найди реальные причины** проблем, не предполагай
3. **Исправь в контексте архитектуры** проекта
4. **Используй best practices** для Kubernetes и CI/CD
5. **Объясни что и почему** было исправлено
6. **Проверь что решение работает** после исправления

**ВАЖНО**: Не создавай временные решения. Все исправления должны быть production-ready и соответствовать best practices.

---

**Начни с анализа всех ключевых файлов и найди реальные причины проблем.**





