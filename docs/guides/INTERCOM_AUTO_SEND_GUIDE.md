# 🚀 Автоматическая отправка сообщений в Intercom - Инструкция

## ✅ ЧТО РЕАЛИЗОВАНО:

### 🎯 Функционал "Contact Customer Support":

**До (старая версия):**
```
Нажатие кнопки → Чат открывается → Текст ПРЕДЗАПОЛНЕН → Пользователь должен нажать Enter
```

**После (новая версия):**
```
Нажатие кнопки → Сообщение АВТОМАТИЧЕСКИ отправляется оператору → Чат открывается 
→ Пользователь видит своё отправленное сообщение 
→ Fin AI или живой оператор отвечает
```

---

## 🔍 ТЕКУЩАЯ СИТУАЦИЯ (из ваших логов):

### ❌ Что сейчас НЕ работает:

```javascript
// 1. JWT генерация
🔐 Generating JWT for user: lllcilician@gmail.com
❌ POST /api/intercom/generate-jwt → 500 (Internal Server Error)

// 2. Автоматическая отправка
📤 Auto-sending order message to Intercom... MH5A1DYQ-NQF2GL  
❌ POST /api/intercom/send-order-message → 500 (Internal Server Error)

// 3. Fallback сработал
⚠️ Updated Intercom without JWT (fallback)
✅ Intercom new message shown: ... (ТОЛЬКО предзаполнение)
```

### ⚠️ ПРИЧИНА:

На сервере **НЕТ** переменных окружения:
- `INTERCOM_API_SECRET` ← нужен для JWT
- `INTERCOM_ACCESS_TOKEN` ← нужен для отправки сообщений

---

## 🎯 РЕШЕНИЕ (2 шага):

### ШАГ 1: Добавить секреты в GitHub

**Откройте:** https://github.com/TheMacroeconomicDao/CantonOTC/settings/secrets/actions

**Добавьте ДВА секрета:**

#### 1.1. INTERCOM_API_SECRET
```
Name:  INTERCOM_API_SECRET
Value: cQU_M0naeip91PryIYEVr8qZFX2dgGCIXRFkV1P7UBI
```

#### 1.2. INTERCOM_ACCESS_TOKEN

**Получите Access Token из Intercom:**
1. Откройте: https://app.intercom.com/a/apps/a131dwle/developers
2. Нажмите **"Developer Hub"** или **"API Access Tokens"**
3. Найдите существующий токен **ИЛИ** создайте новый:
   - Нажмите **"New access token"**
   - Name: `Canton OTC API`
   - Выберите права:
     - ✅ Read users
     - ✅ Write users
     - ✅ Read conversations
     - ✅ Write conversations
   - Нажмите **"Create"**
   - **Скопируйте токен** (покажется только раз!)

4. Добавьте в GitHub Secrets:
   ```
   Name:  INTERCOM_ACCESS_TOKEN
   Value: [скопированный токен]
   ```

### ШАГ 2: Задеплоить изменения

```bash
# Код уже запушен, просто триггерим деплой вручную:

# Вариант A: Создать пустой коммит
git commit --allow-empty -m "trigger: redeploy with Intercom secrets"
git push origin minimal-stage

# Вариант B: Запустить workflow вручную
# Откройте: https://github.com/TheMacroeconomicDao/CantonOTC/actions
# → "Deploy Canton OTC Minimal to Kubernetes"
# → "Run workflow" → "Run workflow"
```

---

## 📊 КАК ПРОВЕРИТЬ ЧТО СООБЩЕНИЕ ОТПРАВИЛОСЬ:

### ✅ После деплоя с секретами:

1. **Откройте:** https://stage.minimal.build.infra.1otc.cc
2. **Создайте тестовый заказ**
3. **Нажмите "Contact Customer Support"**
4. **Проверьте DevTools Console:**

```javascript
// Должно быть:
📤 Auto-sending order message to Intercom... MH5A1DYQ-NQF2GL
✅ Order message auto-sent to Intercom: {
  orderId: 'MH5A1DYQ-NQF2GL',
  conversationId: '12345678'  ← ВАЖНО! Это значит сообщение ОТПРАВЛЕНО
}
✅ Message sent! Our team or AI assistant will respond soon.

// НЕ должно быть:
❌ POST /api/intercom/send-order-message 500
❌ Failed to auto-send order message
```

### ✅ В Intercom Dashboard:

**Откройте:** https://app.intercom.com/a/apps/a131dwle/inbox

**Должны увидеть:**
1. ✅ **Новую conversation** с пользователем
2. ✅ **Сообщение от пользователя** (не от системы!) с деталями заказа:
   ```
   👋 Hello! I need help with my order #MH5A1DYQ-NQF2GL
   
   📋 Order Details:
   • Order ID: MH5A1DYQ-NQF2GL
   • Amount: 10000.00 USDT
   • Receiving: 13051.95 Canton Coin
   ...
   ```
3. ✅ **Статус:** "Waiting for teammate" или "Assigned to Fin"
4. ✅ **Custom attributes** видны в профиле пользователя

---

## 🔍 КАК ПОНЯТЬ ЧТО СООБЩЕНИЕ УШЛО ЖИВОМУ ЧЕЛОВЕКУ:

### В браузере (Console):

**Успешная отправка:**
```javascript
✅ Order message auto-sent to Intercom: {
  orderId: "...",
  conversationId: "123456789"  ← КЛЮЧЕВОЙ ИНДИКАТОР!
}
```

Если есть `conversationId` → **сообщение ОТПРАВЛЕНО** ✅

**Неудачная отправка (fallback):**
```javascript
⚠️ Failed to auto-send order message: {...}
⚠️ Opening chat... Please send the message manually.
✅ Intercom new message shown: ... ← только предзаполнено
```

Если НЕТ `conversationId` → **только предзаполнение** ⚠️

### В Intercom Dashboard:

**Сообщение отправлено:**
```
📬 New conversation
👤 From: customer@example.com
📝 Message: "Hello! I need help with my order #..."
⏰ Just now
🤖 Fin AI is typing... (or)
👤 Waiting for teammate
```

**Сообщение НЕ отправлено:**
```
(Нет новой conversation)
(Или conversation без сообщений)
```

---

## 🎯 ПРОВЕРКА ЛОГОВ СЕРВЕРА:

Если хотите увидеть что происходит на сервере:

```bash
# Посмотреть логи приложения
kubectl logs -f deployment/canton-otc -n canton-otc-minimal-stage

# Должно быть (после добавления секретов):
✅ JWT token generated for user: customer@example.com
📨 Sending order message to Intercom...
✅ Message sent to Intercom: { userId: '...', conversationId: '...' }

# Если секреты НЕ добавлены:
❌ INTERCOM_API_SECRET not configured
❌ Intercom not configured, skipping message send
```

---

## 📋 Checklist для проверки:

### Перед добавлением секретов (СЕЙЧАС):
- [x] Код работает
- [x] Чат открывается
- [x] Текст предзаполняется
- [ ] Сообщение НЕ отправляется автоматически ❌
- [ ] Нет conversationId в логах ❌
- [ ] В Intercom Dashboard пусто ❌

### После добавления секретов (ОЖИДАЕТСЯ):
- [ ] INTERCOM_API_SECRET добавлен в GitHub
- [ ] INTERCOM_ACCESS_TOKEN добавлен в GitHub  
- [ ] Деплой запущен
- [ ] Сообщение отправляется автоматически ✅
- [ ] conversationId появляется в логах ✅
- [ ] В Intercom Dashboard видно conversation ✅
- [ ] Fin AI или оператор отвечает ✅

---

## 🚀 БЫСТРЫЙ СТАРТ:

```bash
# 1. Добавить секреты в GitHub (см. выше)

# 2. Триггер деплоя
git commit --allow-empty -m "trigger: deploy with Intercom secrets"
git push origin minimal-stage

# 3. Подождать ~3-5 минут пока задеплоится

# 4. Проверить:
# - Открыть https://stage.minimal.build.infra.1otc.cc
# - Создать заказ
# - Нажать кнопку
# - Проверить Console на conversationId
# - Проверить Intercom Dashboard на новую conversation
```

---

## 💡 КАК ОТЛИЧИТЬ:

### 🟢 Сообщение ОТПРАВЛЕНО (автоматически):
- ✅ В Console: `conversationId: "123456"`
- ✅ В чате: сообщение УЖЕ отображается как отправленное
- ✅ В Intercom: новая conversation видна
- ✅ Статус: "Waiting for teammate" или "Fin is typing..."

### 🟡 Сообщение ПРЕДЗАПОЛНЕНО (вручную):
- ⚠️ В Console: "Intercom new message shown"
- ⚠️ В чате: текст в поле ввода, **ещё не отправлен**
- ⚠️ Нужно нажать Enter чтобы отправить
- ⚠️ В Intercom Dashboard пока пусто

---

**Сейчас работает режим 🟡 (предзаполнение)**  
**После добавления секретов → режим 🟢 (автоотправка)** 🎉

