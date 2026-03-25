# 📊 Google Sheets Setup Guide for Canton OTC

## Пошаговая настройка Google Sheets API

### Шаг 1: Создание Google Cloud Project

1. **Перейди на Google Cloud Console**: https://console.cloud.google.com/
2. **Создай новый проект**:
   - Нажми "Select a project" → "NEW PROJECT"
   - Название: `Canton-OTC-Exchange`
   - Организация: оставь пустым или выбери свою
   - Нажми **CREATE**

### Шаг 2: Включение Google Sheets API

1. **В консоли Google Cloud** перейди в **APIs & Services** → **Library**
2. **Найди "Google Sheets API"**:
   - В поиске введи "Google Sheets API"
   - Кликни на результат поиска
   - Нажми **ENABLE**

### Шаг 3: Создание Service Account

1. **Перейди в APIs & Services** → **Credentials**
2. **Создай Service Account**:
   - Нажми **+ CREATE CREDENTIALS** → **Service Account**
   - Service account name: `canton-otc-service`
   - Service account ID: `canton-otc-service` (автоматически)
   - Description: `Service account for Canton OTC Exchange`
   - Нажми **CREATE AND CONTINUE**

3. **Настрой роли** (опционально):
   - Role: оставь пустым или выбери "Editor"
   - Нажми **CONTINUE** → **DONE**

### Шаг 4: Создание и скачивание ключей

1. **В разделе Credentials** найди созданный Service Account
2. **Создай JSON ключ**:
   - Кликни на email Service Account
   - Перейди в **Keys** tab
   - Нажми **ADD KEY** → **Create new key**
   - Выбери **JSON** format
   - Нажми **CREATE**
   - **Файл автоматически скачается** - сохрани его в безопасном месте!

### Шаг 5: Извлечение данных из JSON файла

Открой скачанный JSON файл и найди эти поля:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nМНОГО_СТРОК_КЛЮЧА\n-----END PRIVATE KEY-----\n",
  "client_email": "canton-otc-service@your-project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

**Тебе нужны:**
- `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` → `GOOGLE_PRIVATE_KEY`

### Шаг 6: Создание Google Sheets таблицы

1. **Создай новую таблицу**: https://sheets.google.com/
2. **Назови её**: "Canton OTC Orders"
3. **Скопируй ID таблицы** из URL:
   ```
   https://docs.google.com/spreadsheets/d/1ABC123DEF456789GHI/edit#gid=0
                                        ^^^^^^^^^^^^^^^^^
                                        Это твой SHEET_ID
   ```

### Шаг 7: Настройка структуры таблицы

**В первой строке (headers) добавь эти колонки:**

| A | B | C | D | E | F | G | H | I | J | K | L |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Order ID | Timestamp | USDT Amount | Canton Amount | Canton Address | Refund Address | Email | WhatsApp | Telegram | Status | TX Hash | Created At (GMT+3) |

**Пример:**
```
A1: Order ID
B1: Timestamp  
C1: USDT Amount
D1: Canton Amount
E1: Canton Address
F1: Refund Address
G1: Email
H1: WhatsApp
I1: Telegram
J1: Status
K1: TX Hash
L1: Created At (GMT+3)
```

### Шаг 8: Предоставление доступа Service Account

1. **В таблице нажми SHARE** (правый верхний угол)
2. **Добавь Service Account email**:
   - Вставь email из JSON файла: `canton-otc-service@your-project.iam.gserviceaccount.com`
   - Права: **Editor**
   - Нажми **Send**

### Шаг 9: Конфигурация Environment Variables

Добавь в `.env.local`:

```env
# Из JSON файла Service Account:
GOOGLE_SHEET_ID=1ABC123DEF456789GHI
GOOGLE_SERVICE_ACCOUNT_EMAIL=canton-otc-service@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nВСЕ_СТРОКИ_ИЗ_JSON_ФАЙЛА_БЕЗ_ПРОБЕЛОВ\n-----END PRIVATE KEY-----\n"
```

**⚠️ ВАЖНО:**
- Private key должен содержать `\n` вместо реальных переносов строк
- Оберни весь ключ в двойные кавычки
- НЕ добавляй JSON файл в git репозиторий!

### Шаг 10: Тестирование интеграции

```bash
# В корне проекта
npm run dev

# Проверь health endpoint
curl http://localhost:3000/api/health

# Протестируй сервисы (нужен ADMIN_API_KEY)
curl -X POST http://localhost:3000/api/admin/test-services \
  -H "Content-Type: application/json" \
  -d '{"adminKey": "your-admin-key"}'
```

### 🔍 Troubleshooting

**Ошибка авторизации:**
- Проверь правильность email Service Account
- Убедись что private key скопирован полностью
- Проверь что Service Account имеет доступ к таблице

**Ошибка "Spreadsheet not found":**
- Проверь SHEET_ID в URL таблицы
- Убедись что таблица не удалена
- Проверь доступ Service Account к таблице

**Ошибка "Invalid credentials":**
- Пересоздай JSON ключ в Google Cloud Console
- Проверь что API включен
- Убедись что проект активен

### 📊 Структура данных в Sheet

После создания первого заказа увидишь такие данные:

```
Order ID: 1ABC-DEFG
Timestamp: 2025-10-07T22:30:15.000Z  
USDT Amount: 1000
Canton Amount: 5000
Canton Address: canton1qyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqsz5c3j9s
Email: user@example.com
Status: awaiting-deposit
```

### 🎯 Результат

После правильной настройки:
- ✅ Каждый заказ автоматически записывается в Google Sheets
- ✅ Обновления статуса синхронизируются в реальном времени  
- ✅ Админ может управлять заказами через таблицу
- ✅ Полная история всех OTC операций

---

**🔗 Полезные ссылки:**
- Google Cloud Console: https://console.cloud.google.com/
- Google Sheets: https://sheets.google.com/
- API Documentation: https://developers.google.com/sheets/api
