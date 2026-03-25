# 🔄 Миграция заявок в группу клиентов

**Дата**: 3 декабря 2025  
**Статус**: ✅ РЕАЛИЗОВАНО

---

## 📋 Что изменилось

### До изменений:
- ❌ Заявки на покупку/продажу приходили в **группу нотификаций** (TELEGRAM_CHAT_ID)
- ❌ Сообщения операторов клиентам тоже в группу нотификаций

### После изменений:
- ✅ Заявки на покупку/продажу приходят в **группу клиентов** (TELEGRAM_CLIENT_GROUP_CHAT_ID)
- ✅ Сообщения операторов клиентам остаются в **личном чате** (через Intercom/Telegram бота)
- ✅ Группа нотификаций используется только для уведомлений операторов

---

## 🔧 Настройка

### Шаг 1: Получить ID группы клиентов

**Вариант A: Автоматически (рекомендуется)**
```bash
# Напишите "ruheggs" в группе клиентов
# Бот автоматически сохранит ID и покажет его

# Или используйте скрипт:
bash scripts/setup-client-group-secret.sh
```

**Вариант B: Вручную**
1. Добавьте бота [@userinfobot](https://t.me/userinfobot) в группу
2. Бот покажет ID группы (например: `-1001234567890`)

### Шаг 2: Добавить в GitHub Secrets

```bash
gh secret set TELEGRAM_CLIENT_GROUP_CHAT_ID -b "-1001234567890"
```

### Шаг 3: Применить изменения в Kubernetes

```bash
# External Secret автоматически синхронизирует из GitHub
kubectl apply -f config/kubernetes/k8s/minimal-stage/external-secret.yaml

# Или создать secret вручную:
kubectl create secret generic telegram-client-group \
  --from-literal=TELEGRAM_CLIENT_GROUP_CHAT_ID="-1001234567890" \
  -n canton-otc

# Обновить deployment (если нужно):
kubectl rollout restart deployment/canton-otc -n canton-otc
```

---

## 📊 Разделение групп

### Группа нотификаций (TELEGRAM_CHAT_ID)
**Назначение:** Уведомления для операторов
- ✅ Новые заявки (для операторов)
- ✅ Статус заявок
- ✅ Уведомления о готовности сделок
- ✅ Системные уведомления

### Группа клиентов (TELEGRAM_CLIENT_GROUP_CHAT_ID)
**Назначение:** Заявки от клиентов с сайта
- ✅ Заявки на покупку Canton Coin
- ✅ Заявки на продажу Canton Coin
- ✅ Кнопка "Принять заявку" для операторов
- ✅ Детали заявок

### Личный чат (через бота)
**Назначение:** Общение оператора с клиентом
- ✅ Ответы операторов клиентам
- ✅ Вопросы клиентов
- ✅ Поддержка

---

## 🔍 Проверка работы

### 1. Проверить что группа настроена

**В логах должно быть:**
```
✅ Client group chat ID loaded from env: -1001234567890
```

### 2. Создать тестовую заявку

```bash
bash scripts/test-deal-readiness.sh
```

### 3. Проверить куда пришла заявка

- ✅ Должна прийти в **группу клиентов** (TELEGRAM_CLIENT_GROUP_CHAT_ID)
- ❌ НЕ должна прийти в группу нотификаций (TELEGRAM_CHAT_ID)

### 4. Проверить логи

```
📤 Publishing order to client group: {
  orderId: "...",
  chatId: "-1001234567890",
  isClientGroup: true
}
✅ Order published to channel: {
  orderId: "...",
  messageId: ...,
  channel: "-1001234567890"
}
```

---

## 🗄️ Структура секретов

### GitHub Secrets
```
TELEGRAM_CLIENT_GROUP_CHAT_ID=-1001234567890
```

### Kubernetes Secret
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: canton-otc-secrets-minimal-stage
  namespace: canton-otc-minimal-stage
data:
  TELEGRAM_CLIENT_GROUP_CHAT_ID: <base64>
```

### Deployment Environment
```yaml
env:
  - name: TELEGRAM_CLIENT_GROUP_CHAT_ID
    valueFrom:
      secretKeyRef:
        name: canton-otc-secrets-minimal-stage
        key: TELEGRAM_CLIENT_GROUP_CHAT_ID
```

---

## 📝 Измененные файлы

1. **src/lib/services/telegram.ts**
   - `sendPublicOrderNotification()` теперь использует `TELEGRAM_CLIENT_GROUP_CHAT_ID`
   - Fallback на `TELEGRAM_CHAT_ID` если группа клиентов не настроена

2. **src/lib/services/telegramMediator.ts**
   - Обработка сообщений с "ruheggs" для автоматической настройки
   - Сохранение ID группы в память и process.env

3. **config/kubernetes/k8s/minimal-stage/deployment.yaml**
   - Добавлена переменная `TELEGRAM_CLIENT_GROUP_CHAT_ID`

4. **config/kubernetes/k8s/minimal-stage/external-secret.yaml**
   - Добавлен секрет `TELEGRAM_CLIENT_GROUP_CHAT_ID` для синхронизации из GitHub

---

## 🐛 Отладка

### Проблема: Заявки все еще приходят в группу нотификаций

**Проверить:**
1. `TELEGRAM_CLIENT_GROUP_CHAT_ID` установлен в env?
2. Логи содержат "Publishing order to client group"?
3. `isClientGroup: true` в логах?

**Решение:**
```bash
# Проверить env в поде
kubectl exec -n canton-otc deployment/canton-otc -- env | grep TELEGRAM_CLIENT_GROUP

# Если нет - добавить в секреты и перезапустить
kubectl rollout restart deployment/canton-otc -n canton-otc
```

### Проблема: ID группы не сохраняется после перезапуска

**Решение:**
Добавить `TELEGRAM_CLIENT_GROUP_CHAT_ID` в GitHub Secrets и Kubernetes Secret (см. Шаг 2-3)

---

## ✅ Чеклист миграции

- [ ] Создана группа для клиентов
- [ ] Бот добавлен в группу и является админом
- [ ] Написано "ruheggs" в группе (или ID получен вручную)
- [ ] ID группы добавлен в GitHub Secrets
- [ ] External Secret обновлен
- [ ] Deployment обновлен с новой переменной
- [ ] Deployment перезапущен
- [ ] Протестирована отправка заявки
- [ ] Заявка пришла в группу клиентов (не в группу нотификаций)

---

**Автор**: AI Assistant  
**Версия**: 1.0
