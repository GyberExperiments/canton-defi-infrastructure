# 🔧 Отчёт: Исправление логики обновления настроек через ConfigMap

## 📋 Проблема

### Что было:
1. ❌ Настройки (цены, лимиты) хранятся в **ConfigMap** (`canton-otc-config`)
2. ❌ API пытался обновлять **GitHub Secrets** (старая архитектура)
3. ❌ После "сохранения" настройки НЕ менялись в ConfigMap
4. ❌ При автообновлении через 30 сек загружались старые значения из `process.env`
5. ❌ UI показывал старые значения после "успешного" сохранения

### Пользователь видел:
- Меняет цену на `0.1`
- Нажимает "Сохранить"
- Видит уведомление "Всё ок!"
- Через 30 секунд цена возвращается к старому значению

## ✅ Решение

### 1. Новая архитектура хранения настроек

#### ConfigMap (несекретные данные):
- `CANTON_COIN_BUY_PRICE_USD` - цена покупки
- `CANTON_COIN_SELL_PRICE_USD` - цена продажи
- `MIN_USDT_AMOUNT` - минимальная сумма
- `MAX_USDT_AMOUNT` - максимальная сумма
- `BUSINESS_HOURS` - рабочие часы
- `SUPPORT_EMAIL` - email поддержки
- `TELEGRAM_BOT_USERNAME` - Telegram username

#### GitHub Secrets (только критичные креды):
- API токены
- Пароли
- Приватные ключи
- Другие секретные данные

### 2. Созданные файлы

#### `/src/lib/kubernetes-config.ts`
**Kubernetes ConfigMap API клиент**

Функции:
- ✅ Подключение к Kubernetes API
- ✅ Чтение текущего ConfigMap
- ✅ Обновление значений в ConfigMap
- ✅ Мгновенное применение через `process.env`
- ✅ Fallback режим для локальной разработки
- ✅ Поддержка in-cluster и kubeconfig конфигураций

```typescript
const k8sManager = getKubernetesConfigManager();

// Обновление ConfigMap
await k8sManager.updateConfigMap([
  { key: 'CANTON_COIN_BUY_PRICE_USD', value: '0.21' }
]);
```

### 3. Обновлённые файлы

#### `/src/app/api/admin/settings/route.ts`
**Изменения:**

**Было:**
```typescript
// ❌ Обновление GitHub Secrets
const githubService = createGitHubSecretsService();
await githubService.updateMultipleSecrets(secretsToUpdate);
await githubService.triggerWorkflow(workflowId, branch);
```

**Стало:**
```typescript
// ✅ Обновление ConfigMap
const k8sManager = getKubernetesConfigManager();
await k8sManager.updateConfigMap(configUpdates);

// ✅ Мгновенное применение
await configManager.refreshConfig();
```

**Преимущества:**
- ⚡ Мгновенное применение изменений (без ожидания редеплоя)
- 🔒 Безопасность - критичные креды остаются в Secrets
- 🚀 Быстрее - не требуется CI/CD pipeline
- 📊 Прозрачность - все изменения в одном месте

#### `/src/app/admin/settings/SettingsPageContent.tsx`
**Изменения:**

**Было:**
```typescript
// ❌ Не обновляет локальный state
if (response.ok) {
  toast.success('Настройки обновлены!');
  setEditing(false);
  setEditValues({});
}
```

**Стало:**
```typescript
// ✅ Обновляет локальный state сразу
if (response.ok) {
  setSettings(prev => ({
    ...prev,
    cantonCoinBuyPrice: editValues.cantonCoinBuyPrice ?? prev.cantonCoinBuyPrice,
    cantonCoinSellPrice: editValues.cantonCoinSellPrice ?? prev.cantonCoinSellPrice,
    minAmount: editValues.minAmount ?? prev.minAmount,
    maxAmount: editValues.maxAmount ?? prev.maxAmount,
  }));
  
  toast.success('Настройки обновлены в ConfigMap и применены мгновенно! ⚡');
  setEditing(false);
  setEditValues({});
}
```

**Преимущества:**
- ✅ UI обновляется мгновенно
- ✅ Нет "скачков" значений при автообновлении
- ✅ Пользователь видит актуальные значения сразу

#### `/package.json`
**Добавлена зависимость:**
```json
{
  "dependencies": {
    "@kubernetes/client-node": "^1.0.0"
  }
}
```

### 4. Как это работает

#### Схема обновления настроек:

```
1. Админ меняет цену в UI
   ↓
2. PATCH /api/admin/settings
   ↓
3. Валидация данных
   ↓
4. Обновление ConfigMap через Kubernetes API
   ↓
5. Обновление process.env (мгновенно)
   ↓
6. Обновление ConfigManager (мгновенно)
   ↓
7. Обновление UI state (мгновенно)
   ↓
8. ✅ Изменения видны сразу!
```

#### Fallback режим (локальная разработка):

```
Если Kubernetes API недоступен:
   ↓
1. Обновление process.env напрямую
   ↓
2. Обновление ConfigManager
   ↓
3. Обновление UI state
   ↓
4. ⚠️ Изменения временные (до перезапуска)
```

## 🎯 Результат

### До исправления:
1. ❌ Цена меняется → "Сохранено" → Через 30 сек возвращается
2. ❌ Требовался редеплой для применения изменений
3. ❌ Обновления через GitHub Secrets (5-10 минут)
4. ❌ Несоответствие архитектуры (Secrets вместо ConfigMap)

### После исправления:
1. ✅ Цена меняется → "Сохранено" → Остаётся изменённой
2. ✅ Изменения применяются мгновенно
3. ✅ Обновления через ConfigMap (секунды)
4. ✅ Правильная архитектура (ConfigMap для настроек, Secrets для кредов)

## 📦 Необходимые действия

### 1. Установка зависимостей
```bash
pnpm install
```

### 2. Настройка RBAC в Kubernetes
ConfigMap manager требует права на изменение ConfigMap.

Создайте `/config/kubernetes/k8s/minimal-stage/configmap-rbac.yaml`:

```yaml
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: canton-otc-configmap-manager
  namespace: canton-otc-minimal-stage
  labels:
    app: canton-otc
    component: admin

---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: canton-otc-configmap-editor
  namespace: canton-otc-minimal-stage
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list", "watch", "patch", "update"]
  resourceNames: ["canton-otc-config"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: canton-otc-configmap-editor-binding
  namespace: canton-otc-minimal-stage
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: canton-otc-configmap-editor
subjects:
- kind: ServiceAccount
  name: canton-otc-configmap-manager
  namespace: canton-otc-minimal-stage
```

### 3. Обновление Deployment
В `/config/kubernetes/k8s/minimal-stage/deployment.yaml` добавьте:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: canton-otc
spec:
  template:
    spec:
      serviceAccountName: canton-otc-configmap-manager  # ← Добавить
      containers:
      - name: canton-otc
        # ... остальная конфигурация
```

### 4. Применение изменений
```bash
# 1. Создать RBAC
kubectl apply -f config/kubernetes/k8s/minimal-stage/configmap-rbac.yaml

# 2. Обновить deployment
kubectl apply -f config/kubernetes/k8s/minimal-stage/deployment.yaml

# 3. Проверить права
kubectl auth can-i get configmaps \
  --as=system:serviceaccount:canton-otc-minimal-stage:canton-otc-configmap-manager \
  -n canton-otc-minimal-stage

# 4. Проверить статус
kubectl get pods -n canton-otc-minimal-stage
kubectl logs -f deployment/canton-otc -n canton-otc-minimal-stage
```

### 5. Проверка работы

#### Через UI:
1. Откройте админ панель: https://stage.minimal.build.infra.1otc.cc/admin/settings
2. Измените цену на `0.1`
3. Нажмите "Сохранить"
4. ✅ Проверьте что цена осталась `0.1` (не вернулась обратно)

#### Через API:
```bash
# Получить текущие настройки
curl https://stage.minimal.build.infra.1otc.cc/api/admin/settings

# Обновить настройки
curl -X PATCH https://stage.minimal.build.infra.1otc.cc/api/admin/settings \
  -H "Content-Type: application/json" \
  -d '{"cantonCoinBuyPrice": 0.21}'
```

#### Через Kubernetes:
```bash
# Проверить ConfigMap
kubectl get configmap canton-otc-config -n canton-otc-minimal-stage -o yaml

# Посмотреть текущие значения
kubectl get configmap canton-otc-config -n canton-otc-minimal-stage -o jsonpath='{.data.CANTON_COIN_BUY_PRICE_USD}'
```

## 🔍 Диагностика проблем

### Проблема: "ConfigMap недоступен"
**Причина:** Нет прав доступа к ConfigMap

**Решение:**
```bash
# Проверить ServiceAccount
kubectl get sa canton-otc-configmap-manager -n canton-otc-minimal-stage

# Проверить RoleBinding
kubectl get rolebinding canton-otc-configmap-editor-binding -n canton-otc-minimal-stage

# Проверить права
kubectl auth can-i patch configmaps \
  --as=system:serviceaccount:canton-otc-minimal-stage:canton-otc-configmap-manager \
  -n canton-otc-minimal-stage
```

### Проблема: "Изменения не применяются"
**Причина:** ConfigManager не обновляется

**Решение:**
```bash
# Проверить логи
kubectl logs -f deployment/canton-otc -n canton-otc-minimal-stage | grep ConfigMap

# Должны видеть:
# ✅ ConfigMap успешно обновлён
# ✅ ConfigManager обновлён
```

### Проблема: "Fallback режим активирован"
**Причина:** Приложение не запущено в Kubernetes

**Ожидаемое поведение:**
- В локальной разработке: fallback режим - **ОК**
- В production/staging: должен использоваться Kubernetes API

**Проверка:**
```bash
# В pod должна быть переменная
echo $KUBERNETES_SERVICE_HOST

# Если пустая - pod не в Kubernetes
```

## 📊 Мониторинг

### Логи ConfigMap обновлений
```bash
# Смотрим логи в реальном времени
kubectl logs -f deployment/canton-otc -n canton-otc-minimal-stage | grep -E "ConfigMap|🔧|✅|❌"
```

### Аудит изменений
Все изменения логируются через `logAuditEvent`:
- `SETTINGS_UPDATE_ATTEMPT` - попытка обновления
- `SETTINGS_UPDATE_SUCCESS` - успешное обновление
- `SETTINGS_UPDATE_CONFIGMAP_FAILURE` - ошибка обновления
- `SETTINGS_UPDATE_CONFIGMAP_ERROR` - критическая ошибка

## 🎉 Заключение

### Что было исправлено:
1. ✅ Устранена циклическая логика (GitHub Secrets → ConfigMap)
2. ✅ UI теперь обновляется мгновенно
3. ✅ Настройки сохраняются в правильное место (ConfigMap)
4. ✅ Мгновенное применение изменений (без редеплоя)
5. ✅ Fallback режим для локальной разработки
6. ✅ Полная совместимость с существующей архитектурой

### Преимущества новой системы:
- ⚡ **Скорость**: изменения применяются мгновенно
- 🔒 **Безопасность**: критичные креды остаются в Secrets
- 📊 **Прозрачность**: все настройки в ConfigMap
- 🚀 **Простота**: не требуется CI/CD для обновлений
- 🎯 **Надёжность**: fallback режим для разработки

### Следующие шаги:
1. Установить зависимости: `pnpm install`
2. Создать RBAC для ConfigMap
3. Обновить Deployment с ServiceAccount
4. Протестировать в staging
5. Задеплоить в production

---
**Дата:** 23 октября 2025  
**Автор:** AI Assistant  
**Статус:** ✅ Готово к тестированию

