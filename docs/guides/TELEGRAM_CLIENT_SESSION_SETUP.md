# 📱 Telegram Client API - Настройка сессии для отправки сообщений от администратора

**Цель**: Отправка сообщений клиентам напрямую в Telegram от имени администратора (не через бота)

**Библиотека**: GramJS (telegram) - клиентская библиотека для Node.js

---

## 📚 ДОСТУПНЫЕ БИБЛИОТЕКИ ДЛЯ TELEGRAM CLIENT API

### 1. **GramJS** (рекомендуется для Node.js)
- **Пакет**: `telegram`
- **GitHub**: https://github.com/gram-js/gramjs
- **Документация**: https://gram.js.org/
- **Особенности**:
  - ✅ Полная поддержка MTProto API
  - ✅ Работа с сессиями (StringSession, FileSession)
  - ✅ Поддержка всех функций Telegram (отправка сообщений, файлов, медиа)
  - ✅ Активно поддерживается
  - ✅ TypeScript поддержка

### 2. **Pyrogram** (для Python)
- Не подходит для Node.js проекта

### 3. **Telethon** (для Python)
- Не подходит для Node.js проекта

### 4. **TDLib** (официальная)
- Сложнее в настройке, требует компиляции

---

## 🔧 УСТАНОВКА И НАСТРОЙКА

### Шаг 1: Установка зависимостей

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
pnpm add telegram input
```

### Шаг 2: Получение API Credentials

1. Перейдите на https://my.telegram.org/apps
2. Войдите с номером телефона администратора
3. Создайте новое приложение:
   - **App title**: `Canton OTC Admin Client`
   - **Short name**: `canton-otc-admin`
   - **Platform**: `Desktop`
   - **Description**: `Admin client for sending messages to customers`
4. Скопируйте:
   - `api_id` (число, например: `12345678`)
   - `api_hash` (строка, например: `abcdef1234567890abcdef1234567890`)

### Шаг 3: Получение файла сессии

Создайте скрипт для авторизации и получения сессии:

```bash
# Создать файл
touch scripts/setup-telegram-session.js
```

---

## 📝 СКРИПТ ДЛЯ ПОЛУЧЕНИЯ СЕССИИ

**Файл**: `scripts/setup-telegram-session.js`

```javascript
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
const apiHash = process.env.TELEGRAM_API_HASH || "";

if (!apiId || !apiHash) {
  console.error("❌ TELEGRAM_API_ID и TELEGRAM_API_HASH должны быть установлены в .env.local");
  console.error("Получите их на https://my.telegram.org/apps");
  process.exit(1);
}

const stringSession = new StringSession(""); // Используем пустую сессию для первого входа

(async () => {
  console.log("🚀 Запуск Telegram Client для получения сессии...");
  console.log("📱 Используйте номер телефона администратора");
  console.log("");

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Введите номер телефона (с кодом страны, например +79991234567): "),
    password: async () => await input.text("Введите пароль (если установлен 2FA): "),
    phoneCode: async () => await input.text("Введите код из Telegram: "),
    onError: (err) => console.error("❌ Ошибка:", err),
  });

  console.log("✅ Клиент успешно подключен!");
  
  // Получаем информацию о пользователе
  const me = await client.getMe();
  console.log("👤 Авторизован как:", me.firstName, me.lastName || "", `(@${me.username || "без username"})`);
  
  // Сохраняем сессию
  const sessionString = client.session.save();
  
  // Сохраняем в файл
  const sessionPath = path.join(__dirname, "../.telegram-session");
  fs.writeFileSync(sessionPath, sessionString, "utf8");
  
  // Также сохраняем в .env.local для удобства
  const envPath = path.join(__dirname, "../.env.local");
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
    // Удаляем старую сессию если есть
    envContent = envContent.replace(/TELEGRAM_SESSION_STRING=.*\n/g, "");
  }
  envContent += `\nTELEGRAM_SESSION_STRING=${sessionString}\n`;
  fs.writeFileSync(envPath, envContent, "utf8");
  
  console.log("");
  console.log("✅ Сессия сохранена!");
  console.log("📁 Файл сессии:", sessionPath);
  console.log("🔐 Сессия также добавлена в .env.local как TELEGRAM_SESSION_STRING");
  console.log("");
  console.log("⚠️ ВАЖНО: Храните сессию в секрете! Не коммитьте .telegram-session и .env.local в git!");
  
  await client.disconnect();
  process.exit(0);
})();
```

### Запуск скрипта:

```bash
node scripts/setup-telegram-session.js
```

**Процесс:**
1. Введите номер телефона администратора (с кодом страны, например: `+79991234567`)
2. Введите код из Telegram (придет в приложение Telegram)
3. Если установлен 2FA, введите пароль
4. Сессия будет сохранена в `.telegram-session` и `.env.local`

---

## 🔐 БЕЗОПАСНОСТЬ

### Важно:
- ❌ **НЕ коммитьте** файл `.telegram-session` в git
- ❌ **НЕ коммитьте** `.env.local` в git (уже в .gitignore)
- ✅ Храните сессию в Kubernetes Secrets
- ✅ Используйте переменные окружения в production

### Добавьте в .gitignore:

```bash
echo ".telegram-session" >> .gitignore
```

---

## 📦 ИНТЕГРАЦИЯ В ПРОЕКТ

### 1. Добавить в package.json:

```json
{
  "dependencies": {
    "telegram": "^2.25.0",
    "input": "^1.0.1"
  }
}
```

### 2. Создать сервис для отправки сообщений:

**Файл**: `src/lib/services/telegramClient.ts`

См. реализацию ниже.

### 3. Обновить .env.example:

```bash
# Telegram Client API (для отправки сообщений от администратора)
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890
TELEGRAM_SESSION_STRING=your_session_string_here
```

---

## 🚀 ИСПОЛЬЗОВАНИЕ

После настройки сессии, можно отправлять сообщения клиентам:

```typescript
import { telegramClientService } from '@/lib/services/telegramClient';

// Отправить сообщение клиенту по username
await telegramClientService.sendMessage('@customer_username', 'Ваша заявка принята!');

// Отправить сообщение клиенту по user_id
await telegramClientService.sendMessage(123456789, 'Ваша заявка принята!');
```

---

## 🔄 ОБНОВЛЕНИЕ СЕССИИ

Если сессия истекла или нужно обновить:

1. Удалите старую сессию:
   ```bash
   rm .telegram-session
   ```

2. Запустите скрипт снова:
   ```bash
   node scripts/setup-telegram-session.js
   ```

---

## 📚 ДОПОЛНИТЕЛЬНЫЕ РЕСУРСЫ

- **GramJS Документация**: https://gram.js.org/
- **GramJS GitHub**: https://github.com/gram-js/gramjs
- **Telegram API**: https://core.telegram.org/api
- **Примеры использования**: https://github.com/gram-js/gramjs/tree/master/examples

---

## ⚠️ ОГРАНИЧЕНИЯ

1. **Rate Limits**: Telegram ограничивает количество сообщений (около 20 сообщений в секунду)
2. **Spam Protection**: Telegram может заблокировать аккаунт при массовой рассылке
3. **2FA**: Если у администратора включен 2FA, потребуется пароль при авторизации
4. **Сессия**: Сессия может истечь, нужно периодически обновлять

---

**Автор**: AI Assistant  
**Дата**: 2025-01-27  
**Версия**: 1.0
