# 🔐 Инструкция: Получение сессии Telegram аккаунта администратора

**Дата**: 2025-01-27  
**Цель**: Настройка Telegram Client API для отправки сообщений от администратора

---

## 📋 ОБЗОР

Для работы Telegram Client API нужна сессия администратора. Это позволяет отправлять сообщения от имени администратора без ограничений Bot API (например, отправка первого сообщения без `/start`).

---

## 🔧 ШАГ 1: Получение API Credentials

### 1.1 Перейдите на https://my.telegram.org/apps

1. Откройте браузер и перейдите на https://my.telegram.org/apps
2. Войдите с номером телефона администратора (тот, от которого будут отправляться сообщения)
3. Если не зарегистрированы, создайте аккаунт

### 1.2 Создайте новое приложение

1. Нажмите **"Create new application"**
2. Заполните форму:
   - **App title**: `Canton OTC Admin Client` (или любое название)
   - **Short name**: `canton_otc_admin` (или любое короткое имя)
   - **Platform**: `Other`
   - **URL**: ⚠️ **ОПЦИОНАЛЬНО** - можно оставить пустым или указать любой валидный URL (например, `https://example.com` или URL вашего сайта)
     - Для получения сессии через GramJS URL **не требуется**
     - Если поле обязательное, укажите любой валидный URL
   - **Description**: `Admin client for Canton OTC Exchange notifications` (опционально)
3. Нажмите **"Create"**

⚠️ **ВАЖНО**: 
- Поле **URL** является опциональным для получения сессии
- Можно указать любой валидный URL или оставить пустым (если разрешено)
- URL не используется для авторизации через MTProto API

### 1.3 Скопируйте API credentials

После создания приложения вы увидите:
- **api_id**: число (например, `12345678`)
- **api_hash**: строка (например, `abcdef1234567890abcdef1234567890`)

⚠️ **ВАЖНО**: Не делитесь этими данными! Они дают доступ к вашему аккаунту.

---

## 🔧 ШАГ 2: Добавление credentials в проект

### 2.1 Добавьте в `.env.local`

Создайте или откройте файл `.env.local` в корне проекта:

```bash
# Telegram Client API (для отправки от администратора)
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890
```

**Замените** `12345678` и `abcdef1234567890abcdef1234567890` на ваши реальные значения.

---

## 🔧 ШАГ 3: Установка зависимостей

Убедитесь, что установлены необходимые пакеты:

```bash
pnpm add telegram input
```

Или если используете npm:

```bash
npm install telegram input
```

---

## 🔧 ШАГ 4: Получение сессии

### 4.1 Запустите скрипт

```bash
node scripts/setup-telegram-session.js
```

### 4.2 Следуйте инструкциям

Скрипт попросит:

1. **Номер телефона**: Введите номер администратора с кодом страны
   - Пример: `+79991234567` (Россия)
   - Пример: `+1234567890` (США)

2. **Код из Telegram**: 
   - Telegram отправит код в приложение Telegram на вашем телефоне
   - Введите код в терминал

3. **Пароль (если установлен 2FA)**:
   - Если у аккаунта включена двухфакторная аутентификация
   - Введите пароль 2FA

### 4.3 Результат

После успешной авторизации вы увидите:

```
✅ Клиент успешно подключен!
👤 Авторизован как: Имя Фамилия (@username)
✅ Сессия сохранена!
📁 Файл сессии: /path/to/.telegram-session
🔐 Сессия также добавлена в .env.local как TELEGRAM_SESSION_STRING
```

---

## 🔧 ШАГ 5: Проверка сессии

### 5.1 Проверьте файлы

После выполнения скрипта должны быть созданы:

1. **`.telegram-session`** - файл сессии (бинарный)
2. **`.env.local`** - должен содержать `TELEGRAM_SESSION_STRING=...`

### 5.2 Проверьте `.env.local`

Откройте `.env.local` и убедитесь, что есть:

```bash
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890
TELEGRAM_SESSION_STRING=1BVtsOHwBu5X... (длинная строка)
```

---

## 🔧 ШАГ 6: Настройка для production

### 6.1 Kubernetes Secrets

Для production добавьте секреты в Kubernetes:

```bash
kubectl create secret generic telegram-client-api \
  --from-literal=TELEGRAM_API_ID="12345678" \
  --from-literal=TELEGRAM_API_HASH="abcdef1234567890abcdef1234567890" \
  --from-literal=TELEGRAM_SESSION_STRING="1BVtsOHwBu5X..." \
  -n canton-otc
```

### 6.2 GitHub Secrets (для CI/CD)

Если используете GitHub Actions:

1. Перейдите в Settings → Secrets and variables → Actions
2. Добавьте секреты:
   - `TELEGRAM_API_ID`
   - `TELEGRAM_API_HASH`
   - `TELEGRAM_SESSION_STRING`

### 6.3 Docker Environment

Если используете Docker, добавьте в `docker-compose.yml`:

```yaml
environment:
  - TELEGRAM_API_ID=${TELEGRAM_API_ID}
  - TELEGRAM_API_HASH=${TELEGRAM_API_HASH}
  - TELEGRAM_SESSION_STRING=${TELEGRAM_SESSION_STRING}
```

---

## ⚠️ БЕЗОПАСНОСТЬ

### ⚠️ ВАЖНО:

1. **Не коммитьте сессию в git!**
   - Файл `.telegram-session` должен быть в `.gitignore`
   - Переменная `TELEGRAM_SESSION_STRING` не должна быть в `.env` (только в `.env.local`)

2. **Храните сессию в секретах**
   - Используйте Kubernetes Secrets
   - Используйте GitHub Secrets
   - Не храните в открытом виде

3. **Сессия = доступ к аккаунту**
   - С сессией можно отправлять сообщения от вашего имени
   - Храните как пароль

4. **Если сессия скомпрометирована:**
   - Перегенерируйте сессию (запустите скрипт заново)
   - Удалите старую сессию из всех мест

---

## 🔍 ПРОВЕРКА РАБОТЫ

### Тест подключения

После настройки можно проверить работу:

1. Запустите приложение
2. Проверьте логи при старте:
   ```
   ✅ Telegram Client API initialized
   ✅ Telegram Client connected
   ```

3. При принятии заявки тейкером:
   ```
   ✅ Taker notified via Telegram Client API
   ```

---

## 🐛 РЕШЕНИЕ ПРОБЛЕМ

### Проблема: "TELEGRAM_API_ID и TELEGRAM_API_HASH должны быть установлены"

**Решение**: Добавьте в `.env.local`:
```bash
TELEGRAM_API_ID=ваш_api_id
TELEGRAM_API_HASH=ваш_api_hash
```

### Проблема: "Ошибка при получении сессии"

**Возможные причины:**
1. Неправильный номер телефона (нужен с кодом страны)
2. Неправильный код из Telegram (проверьте приложение)
3. Проблемы с сетью (проверьте интернет)

**Решение**: Запустите скрипт заново и внимательно введите данные.

### Проблема: "Client not connected" в логах

**Решение**: 
1. Проверьте, что `TELEGRAM_SESSION_STRING` установлен
2. Проверьте, что сессия не истекла (перегенерируйте если нужно)
3. Проверьте логи на ошибки подключения

---

## 📝 ИТОГОВАЯ ПРОВЕРКА

После настройки у вас должно быть:

- ✅ `TELEGRAM_API_ID` в `.env.local`
- ✅ `TELEGRAM_API_HASH` в `.env.local`
- ✅ `TELEGRAM_SESSION_STRING` в `.env.local`
- ✅ Файл `.telegram-session` создан
- ✅ Пакеты `telegram` и `input` установлены
- ✅ Приложение запускается без ошибок

---

**Автор**: AI Assistant  
**Дата**: 2025-01-27  
**Версия**: 1.0

