# 🔐 Настройка credentials для системы публичных заявок

## ✅ Выполненные изменения

### 1. ConfigMap (несекретные данные)

**Файлы:**
- `config/kubernetes/k8s/configmap.yaml` (production/main)
- `config/kubernetes/k8s/minimal-stage/configmap.yaml` (minimal-stage)

**Добавлено:**
```yaml
TELEGRAM_OPERATOR_USERNAME: "@hypov"  # Username оператора для публичных заявок
TELEGRAM_SERVICE_BOT_USERNAME: "@TECH_HY_Customer_Service_bot"  # Сервисный бот для связи с клиентами
```

### 2. Kubernetes Secrets (секретные данные)

**Файлы:**
- `config/kubernetes/k8s/secret.template.yaml` - шаблон для создания секретов
- `config/kubernetes/k8s/minimal-stage/external-secret.yaml` - External Secrets для minimal-stage

**Добавлено в secret.template.yaml:**
```yaml
# Telegram Public Channel Configuration
TELEGRAM_PUBLIC_CHANNEL_ID: ${TELEGRAM_PUBLIC_CHANNEL_ID_B64}
TELEGRAM_SERVICE_BOT_USERNAME: ${TELEGRAM_SERVICE_BOT_USERNAME_B64}
TELEGRAM_OPERATOR_USERNAME: ${TELEGRAM_OPERATOR_USERNAME_B64}

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL_B64}
SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY_B64}
```

**Добавлено в external-secret.yaml:**
```yaml
# Telegram Public Channel Configuration
- secretKey: TELEGRAM_PUBLIC_CHANNEL_ID
  remoteRef:
    key: TELEGRAM_PUBLIC_CHANNEL_ID
- secretKey: TELEGRAM_SERVICE_BOT_USERNAME
  remoteRef:
    key: TELEGRAM_SERVICE_BOT_USERNAME
- secretKey: TELEGRAM_OPERATOR_USERNAME
  remoteRef:
    key: TELEGRAM_OPERATOR_USERNAME

# Supabase Configuration
- secretKey: NEXT_PUBLIC_SUPABASE_URL
  remoteRef:
    key: NEXT_PUBLIC_SUPABASE_URL
- secretKey: SUPABASE_SERVICE_ROLE_KEY
  remoteRef:
    key: SUPABASE_SERVICE_ROLE_KEY
```

### 3. Deployment (переменные окружения в контейнерах)

**Файлы:**
- `config/kubernetes/k8s/deployment.yaml` (production/main)
- `config/kubernetes/k8s/minimal-stage/deployment.yaml` (minimal-stage)

**Добавлено в deployment.yaml:**

**Из ConfigMap (несекретные):**
```yaml
- name: TELEGRAM_SERVICE_BOT_USERNAME
  valueFrom:
    configMapKeyRef:
      name: canton-otc-config
      key: TELEGRAM_SERVICE_BOT_USERNAME
- name: TELEGRAM_OPERATOR_USERNAME
  valueFrom:
    configMapKeyRef:
      name: canton-otc-config
      key: TELEGRAM_OPERATOR_USERNAME
```

**Из Secrets (секретные):**
```yaml
- name: TELEGRAM_PUBLIC_CHANNEL_ID
  valueFrom:
    secretKeyRef:
      name: canton-otc-secrets
      key: TELEGRAM_PUBLIC_CHANNEL_ID
      optional: true
- name: NEXT_PUBLIC_SUPABASE_URL
  valueFrom:
    secretKeyRef:
      name: canton-otc-secrets
      key: NEXT_PUBLIC_SUPABASE_URL
      optional: true
- name: SUPABASE_SERVICE_ROLE_KEY
  valueFrom:
    secretKeyRef:
      name: canton-otc-secrets
      key: SUPABASE_SERVICE_ROLE_KEY
      optional: true
```

### 4. GitHub Actions Workflow

**Файл:** `.github/workflows/deploy-minimal-stage.yml`

**Добавлено:**
- Кодирование новых секретов в base64
- Передача секретов из GitHub Secrets в workflow

```yaml
# Telegram Public Channel Configuration (секретные данные)
export TELEGRAM_PUBLIC_CHANNEL_ID_B64=$(safe_b64 "$TELEGRAM_PUBLIC_CHANNEL_ID")

# Supabase Configuration (секретные данные)
export NEXT_PUBLIC_SUPABASE_URL_B64=$(safe_b64 "$NEXT_PUBLIC_SUPABASE_URL")
export SUPABASE_SERVICE_ROLE_KEY_B64=$(safe_b64 "$SUPABASE_SERVICE_ROLE_KEY")
```

## 📋 Требуемые GitHub Secrets

Для работы системы публичных заявок необходимо добавить следующие секреты в GitHub:

### Обязательные секреты:
1. `TELEGRAM_PUBLIC_CHANNEL_ID` - ID публичного Telegram канала (например: `@your_public_channel` или `-1001234567890`)
2. `NEXT_PUBLIC_SUPABASE_URL` - URL Supabase проекта
3. `SUPABASE_SERVICE_ROLE_KEY` - Service Role ключ Supabase

### Опциональные (если не используются значения из ConfigMap):
- `TELEGRAM_SERVICE_BOT_USERNAME` - если отличается от ConfigMap
- `TELEGRAM_OPERATOR_USERNAME` - если отличается от ConfigMap

## 🔧 Использование существующих credentials

### Telegram Bot Token
✅ Используется существующий `TELEGRAM_BOT_TOKEN` из секретов - тот же бот будет использоваться для публикации в публичный канал.

### Telegram Chat ID
✅ Используется существующий `TELEGRAM_CHAT_ID` из секретов - для отправки уведомлений операторам в приватный канал.

### Telegram Bot Username
✅ Используется `TELEGRAM_BOT_USERNAME` из ConfigMap (`@CantonOTC_Bot`).

### Новые переменные
- `TELEGRAM_PUBLIC_CHANNEL_ID` - новый секрет для публичного канала
- `TELEGRAM_SERVICE_BOT_USERNAME` - добавлен в ConfigMap (`@TECH_HY_Customer_Service_bot`)
- `TELEGRAM_OPERATOR_USERNAME` - добавлен в ConfigMap (`@hypov`)

## 🚀 Деплой

### Для minimal-stage:
Секреты автоматически синхронизируются через External Secrets Operator из GitHub Secrets.

### Для production/main:
Секреты создаются вручную через `kubectl` или через workflow, который использует `secret.template.yaml`.

## ✅ Проверка

После деплоя проверьте:

1. **ConfigMap:**
   ```bash
   kubectl get configmap canton-otc-config -n canton-otc -o yaml | grep TELEGRAM
   ```

2. **Secrets:**
   ```bash
   kubectl get secret canton-otc-secrets -n canton-otc -o jsonpath='{.data}' | jq 'keys'
   ```

3. **Переменные в поде:**
   ```bash
   kubectl exec -n canton-otc deployment/canton-otc -- env | grep TELEGRAM
   kubectl exec -n canton-otc deployment/canton-otc -- env | grep SUPABASE
   ```

## 📝 Примечания

- Все несекретные данные (usernames) хранятся в ConfigMap
- Секретные данные (токены, ключи, channel IDs) хранятся в Kubernetes Secrets
- Для minimal-stage используется External Secrets Operator для автоматической синхронизации из GitHub Secrets
- Для production секреты создаются вручную или через workflow
