# 🔐 Инструкция: Добавление INTERCOM_API_SECRET в GitHub Secrets

## ✅ ЧТО СДЕЛАНО В КОДЕ:

1. ✅ Создан API endpoint `/api/intercom/generate-jwt` для генерации JWT токенов
2. ✅ Обновлён `IntercomProvider` для использования JWT
3. ✅ Добавлен `INTERCOM_API_SECRET` в GitHub Actions workflow
4. ✅ Обновлён `secret.template.yaml` для Kubernetes
5. ✅ Установлен пакет `jsonwebtoken`
6. ✅ Проект успешно собирается ✅

---

## 🎯 ШАГ 1: Добавить секрет в GitHub Repository

### Откройте настройки репозитория:

1. Перейдите на: https://github.com/TheMacroeconomicDao/CantonOTC
2. Нажмите **Settings** (вверху справа)
3. В левом меню: **Secrets and variables** → **Actions**
4. Нажмите **New repository secret**

### Добавьте новый секрет:

```
Name: INTERCOM_API_SECRET

Value: cQU_M0naeip91PryIYEVr8qZFX2dgGCIXRFkV1P7UBI
```

**⚠️ ВАЖНО:** Скопируйте значение ТОЧНО, без пробелов и переносов строк!

5. Нажмите **Add secret**

---

## 🎯 ШАГ 2: Проверить что секрет добавлен

После добавления вы должны увидеть в списке секретов:

```
✅ INTERCOM_API_SECRET          Updated now by @username
```

**Все существующие секреты Intercom:**
- `INTERCOM_APP_ID` (если есть)
- `NEXT_PUBLIC_INTERCOM_APP_ID` (должен быть: a131dwle)
- `INTERCOM_ACCESS_TOKEN`
- `INTERCOM_ADMIN_ID`
- `INTERCOM_WEBHOOK_SECRET`
- `INTERCOM_API_SECRET` ← **НОВЫЙ!**

---

## 🎯 ШАГ 3: Проверить другие Intercom секреты

Убедитесь что эти секреты тоже настроены:

### 1. NEXT_PUBLIC_INTERCOM_APP_ID

```bash
Name: NEXT_PUBLIC_INTERCOM_APP_ID
Value: a131dwle
```

### 2. INTERCOM_ACCESS_TOKEN (если используется серверный API)

Получите из Intercom Dashboard:
1. Settings → Developers → Developer Hub
2. Скопируйте Access Token
3. Добавьте в GitHub Secrets

---

## 🎯 ШАГ 4: Задеплоить изменения

После добавления секрета, следующий push в ветку `minimal-stage` автоматически:

1. Прочитает новый секрет из GitHub
2. Закодирует его в base64
3. Создаст Kubernetes Secret
4. Применит его в кластер
5. Перезапустит приложение

### Триггер деплоя:

```bash
# Коммит и пуш изменений
git add -A
git commit -m "feat: add Intercom JWT authentication support"
git push origin minimal-stage

# Или запустить вручную через GitHub Actions:
# Actions → Deploy Canton OTC Minimal → Run workflow
```

---

## 🧪 ШАГ 5: Тестирование после деплоя

### Локальное тестирование (перед деплоем):

```bash
# 1. Создать .env.local (если ещё нет)
cat > .env.local << 'EOF'
NEXT_PUBLIC_INTERCOM_APP_ID=a131dwle
INTERCOM_API_SECRET=cQU_M0naeip91PryIYEVr8qZFX2dgGCIXRFkV1P7UBI
EOF

# 2. Запустить dev сервер
pnpm dev

# 3. Открыть http://localhost:3000
# 4. Создать тестовый заказ
# 5. Проверить DevTools Console:
#    ✅ "🔐 Generating JWT for user: email@example.com"
#    ✅ "✅ Intercom user updated with JWT: email@example.com"
#    ❌ НЕ должно быть "403 Forbidden"
```

### Production тестирование (после деплоя):

```bash
# 1. Открыть https://stage.minimal.build.infra.1otc.cc
# 2. Создать тестовый заказ
# 3. Нажать "Contact Customer Support"
# 4. Проверить DevTools Console:
#    ✅ Должно быть: "✅ Intercom user updated with JWT"
#    ❌ НЕ должно быть: "403 Forbidden"
```

### Проверка в Intercom Dashboard:

1. Откройте: https://app.intercom.com/a/apps/a131dwle/inbox
2. Должны увидеть:
   - ✅ Нового пользователя с email
   - ✅ Custom attributes с данными заказа
   - ✅ Order ID, amount, Canton address

---

## 🔍 Проверка что workflow использует секрет

Откройте последний workflow run:
https://github.com/TheMacroeconomicDao/CantonOTC/actions

В логах должно быть:

```bash
🔐 Создание секретов приложения для minimal-stage...
✅ Используем актуальные значения из GitHub Secrets
✅ Все секреты закодированы в base64 с актуальными значениями
✅ Секреты приложения успешно созданы в Kubernetes
```

**Проверить в Kubernetes:**

```bash
# Проверить что секрет создан
kubectl get secret canton-otc-secrets-minimal-stage \
  -n canton-otc-minimal-stage -o yaml

# Должна быть строка:
#   INTERCOM_API_SECRET: Y1FVX00wbmFlaXA5MVByeUlZRVZyOHFaRlgyZGdDR0lYUkZrVjFQN1VCSQ==
```

---

## 📝 Структура интеграции

### Клиент (Browser) → Server → Intercom

```
1. Пользователь создаёт заказ
   ↓
2. Браузер вызывает: intercomUtils.updateUser({...})
   ↓
3. Код делает POST /api/intercom/generate-jwt
   ↓
4. Server генерирует JWT с HMAC подписью используя INTERCOM_API_SECRET
   ↓
5. Server возвращает JWT токен
   ↓
6. Браузер обновляет Intercom: window.Intercom('update', {intercom_user_jwt: token})
   ↓
7. Intercom проверяет JWT подпись ✅
   ↓
8. Intercom извлекает данные из JWT payload
   ↓
9. Администратор видит все данные заказа! 🎉
```

---

## ⚠️ Важные замечания

### 1. Безопасность секрета

- ❌ **НЕ** коммитьте `.env.local` в Git
- ❌ **НЕ** отправляйте секрет в публичных каналах
- ✅ Храните только в GitHub Secrets
- ✅ Используйте только для stage/production окружений

### 2. Ротация секрета

Если нужно сменить секрет:

1. Сгенерируйте новый в Intercom Dashboard:
   - Settings → Security → Generate new API Secret
2. Обновите GitHub Secret `INTERCOM_API_SECRET`
3. Запустите новый деплой
4. Старый секрет перестанет работать

### 3. Для локальной разработки

Создайте `.env.local` вручную:

```bash
echo "NEXT_PUBLIC_INTERCOM_APP_ID=a131dwle" > .env.local
echo "INTERCOM_API_SECRET=cQU_M0naeip91PryIYEVr8qZFX2dgGCIXRFkV1P7UBI" >> .env.local
```

Этот файл **НЕ** попадёт в Git (.gitignore)

---

## ✅ Checklist

### Настройка GitHub:
- [ ] Открыл Settings → Secrets and variables → Actions
- [ ] Добавил `INTERCOM_API_SECRET` с правильным значением
- [ ] Проверил что секрет появился в списке

### Настройка Intercom Dashboard:
- [ ] Включил "Enforce JWT Authentication"
- [ ] Проверил что `INTERCOM_API_SECRET` совпадает с тем что в Intercom

### Деплой:
- [ ] Запушил изменения в `minimal-stage`
- [ ] Проверил что GitHub Action успешно выполнился
- [ ] Проверил логи deployment - секрет применился

### Тестирование:
- [ ] Создал тестовый заказ
- [ ] Нет ошибок 403 в Console
- [ ] JWT генерируется (лог "🔐 Generating JWT")
- [ ] Данные появились в Intercom Dashboard

---

**Время выполнения:** ~3 минуты  
**Сложность:** Низкая  
**Результат:** Полная безопасность + передача всех данных в Intercom! 🎉

