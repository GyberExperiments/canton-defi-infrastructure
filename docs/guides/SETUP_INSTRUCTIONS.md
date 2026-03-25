# 🚀 Инструкции по настройке Canton OTC с Google Sheets

## 1. Создай .env.local файл

```bash
# Скопируй пример конфигурации
cp .env.example .env.local
```

## 2. Создай Google Sheets таблицу

1. **Открой Google Sheets**: https://sheets.google.com/
2. **Создай новую таблицу**: "Canton OTC Orders"
3. **Добавь заголовки в первую строку (A1:L1):**

| A | B | C | D | E | F | G | H | I | J | K | L |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Order ID | Timestamp | USDT Amount | Canton Amount | Canton Address | Refund Address | Email | WhatsApp | Telegram | Status | TX Hash | Created At (GMT+3) |

4. **Скопируй SHEET_ID из URL:**
   ```
   https://docs.google.com/spreadsheets/d/1ABC123DEF456789GHI/edit#gid=0
                                        ^^^^^^^^^^^^^^^^^
                                        Это твой SHEET_ID
   ```

5. **Дай доступ Service Account:**
   - Нажми **SHARE** в правом верхнем углу
   - Добавь email: `canton-otc@gyber-inter-speak.iam.gserviceaccount.com`
   - Права: **Editor**
   - Нажми **Send**

## 3. Обнови .env.local

Замени `ВСТАВЬ_SHEET_ID_СЮДА` на реальный ID твоей таблицы в файле `.env.local`.

## 4. Протестируй подключение

```bash
# Запусти проект
npm run dev

# Тестируй все сервисы 
curl -X POST http://localhost:3000/api/admin/test-services \
  -H "Content-Type: application/json" \
  -d '{"adminKey": "canton-admin-2025-super-secure-key"}'
```

## 5. Проверь health endpoint

```bash
curl http://localhost:3000/api/health
```

Должен вернуть статус всех сервисов включая Google Sheets.

## ✅ Готово!

После успешной настройки каждый заказ будет автоматически сохраняться в Google Sheets с полной информацией о клиенте и статусе операции.
