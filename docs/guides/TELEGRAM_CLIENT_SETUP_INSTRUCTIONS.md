# 📱 Инструкция по активации Telegram Client бота

## Цель
Активировать Telegram Client API для отправки сообщений клиентам, которые приняли заявки в группе, используя номер телефона **+7 993 249 9264**.

---

## ✅ ШАГ 1: Получение API credentials (требуется действие пользователя)

1. Откройте https://my.telegram.org/apps
2. Войдите с номером телефона: **+7 993 249 9264**
3. Создайте новое приложение:
   - **App title**: `Canton OTC Admin Client`
   - **Short name**: `canton_otc_client`
   - **Platform**: `Desktop` или `Other`
   - **URL**: опционально (можно оставить пустым)
4. Скопируйте:
   - **api_id** (число, например: `12345678`)
   - **api_hash** (строка, например: `abcdef1234567890abcdef1234567890`)

---

## ✅ ШАГ 2: Добавление credentials в .env.local

Откройте файл `.env.local` в корне проекта и добавьте:

```bash
TELEGRAM_API_ID=ваш_api_id
TELEGRAM_API_HASH=ваш_api_hash
```

**Замените** значения на реальные из шага 1.

---

## ✅ ШАГ 3: Настройка сессии

Запустите скрипт для получения сессии:

```bash
node scripts/setup-telegram-session-improved.js
```

Скрипт попросит:
1. **Номер телефона**: Введите `+79932499264` (без пробелов)
2. **Код из Telegram**: Введите код, который придет в приложение Telegram
3. **Пароль 2FA** (если установлен): Введите пароль или нажмите Enter

После успешного выполнения:
- ✅ Файл `.telegram-session` будет создан
- ✅ `TELEGRAM_SESSION_STRING` будет добавлен в `.env.local`

---

## ✅ ШАГ 4: Создание Kubernetes Secret

Запустите скрипт для создания/обновления Secret в Kubernetes:

```bash
./scripts/setup-telegram-client-k8s.sh
```

Скрипт автоматически:
- ✅ Прочитает значения из `.env.local`
- ✅ Создаст или обновит Secret `canton-otc-secrets` в namespace `canton-otc`
- ✅ Добавит `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION_STRING`

---

## ✅ ШАГ 5: Перезапуск deployment

Перезапустите deployment для применения изменений:

```bash
kubectl rollout restart deployment/canton-otc -n canton-otc
```

Или дождитесь автоматического перезапуска (если настроен).

---

## ✅ ШАГ 6: Тестирование

Проверьте подключение:

```bash
./scripts/test-telegram-client.sh
```

Или вручную:

```bash
kubectl exec -n canton-otc deployment/canton-otc -- node -e "
const { telegramClientService } = require('./src/lib/services/telegramClient');
telegramClientService.checkConnection().then(connected => {
  console.log(connected ? '✅ Подключено' : '❌ Не подключено');
  if (connected) {
    return telegramClientService.getMe();
  }
}).then(me => {
  if (me) {
    console.log('👤 Пользователь:', me.firstName, me.lastName || '', \`(@\${me.username || 'no username'})\`);
  }
}).catch(err => console.error('❌ Ошибка:', err.message));
"
```

---

## 📋 Проверка статуса

Проверьте что все переменные окружения установлены в pod:

```bash
kubectl exec -n canton-otc deployment/canton-otc -- env | grep TELEGRAM
```

Должны быть видны:
- `TELEGRAM_API_ID`
- `TELEGRAM_API_HASH`
- `TELEGRAM_SESSION_STRING`

---

## 🔧 Устранение проблем

### Ошибка: "Telegram Client API not configured"
- Проверьте что все переменные добавлены в Kubernetes Secret
- Проверьте что deployment перезапущен
- Проверьте логи: `kubectl logs -n canton-otc deployment/canton-otc`

### Ошибка: "Session expired or invalid"
- Запустите `setup-telegram-session-improved.js` снова
- Обновите Secret через `setup-telegram-client-k8s.sh`
- Перезапустите deployment

### Ошибка: "Telegram Client API package not installed"
- Убедитесь что `pnpm install` выполнен
- Проверьте что пакет `telegram` в `package.json`

---

## ✅ Готово!

После выполнения всех шагов Telegram Client API будет готов к работе. При принятии заявки тейкером, он получит сообщение от администратора через Client API.





