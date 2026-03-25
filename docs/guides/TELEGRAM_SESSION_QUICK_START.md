# 🚀 Быстрый старт: Получение сессии Telegram администратора

**Время выполнения**: 5-10 минут

---

## 📋 ЧТО НУЖНО

1. ✅ Аккаунт Telegram администратора (номер телефона)
2. ✅ Доступ к https://my.telegram.org/apps
3. ✅ Установленный Node.js и pnpm

---

## 🔧 ШАГИ

### 1. Получите API credentials (2 минуты)

1. Откройте https://my.telegram.org/apps
2. Войдите с номером администратора
3. Создайте приложение:
   - **App title**: любое название (например, `Canton OTC Admin`)
   - **Short name**: короткое имя (например, `canton_otc`)
   - **Platform**: `Other`
   - **URL**: ⚠️ опционально - можно оставить пустым или указать любой URL (например, `https://example.com`)
4. Скопируйте `api_id` и `api_hash`

### 2. Добавьте в `.env.local` (1 минута)

```bash
TELEGRAM_API_ID=ваш_api_id
TELEGRAM_API_HASH=ваш_api_hash
```

### 3. Установите зависимости (1 минута)

```bash
pnpm add telegram input
```

### 4. Запустите скрипт (2-5 минут)

```bash
node scripts/setup-telegram-session.js
```

Следуйте инструкциям:
- Введите номер телефона (с кодом страны, например `+79991234567`)
- Введите код из Telegram
- Введите пароль 2FA (если установлен)

### 5. Проверьте результат

После выполнения должны быть:
- ✅ Файл `.telegram-session` создан
- ✅ `TELEGRAM_SESSION_STRING` добавлен в `.env.local`

---

## ✅ ГОТОВО!

Теперь Telegram Client API готов к работе. При принятии заявки тейкером, он получит сообщение от администратора.

---

**Подробная инструкция**: `docs/guides/TELEGRAM_SESSION_SETUP_ADMIN.md`

