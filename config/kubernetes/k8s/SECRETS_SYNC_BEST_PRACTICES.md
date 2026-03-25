# 🔐 Best Practices: Синхронизация секретов из GitHub в Kubernetes

## 📋 Архитектура решения

Для production окружения используется **GitHub Actions workflow** для синхронизации секретов из GitHub Secrets в Kubernetes Secrets. Это соответствует industry best practices:

### ✅ Преимущества подхода:

1. **Single Source of Truth** - все секреты хранятся в GitHub Secrets
2. **Автоматическая синхронизация** - при каждом деплое секреты обновляются
3. **Безопасность** - секреты не хранятся в Git, только в зашифрованном виде в GitHub
4. **Аудит** - все изменения секретов отслеживаются через GitHub Actions logs
5. **Простота** - не требует дополнительных операторов в кластере

## 🏗️ Текущая реализация

### Workflow: `.github/workflows/simple-deploy.yml`

Секреты синхронизируются автоматически при каждом деплое через шаг:

```yaml
- name: 🔐 Setup application secrets
  run: |
    # Создаем секрет из template с подстановкой значений из GitHub Secrets
    envsubst '...' < secret.template.yaml > secret.yaml
    kubectl apply -f secret.yaml
  env:
    GOOGLE_SHEET_ID: ${{ secrets.GOOGLE_SHEET_ID }}
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
    # ... и т.д.
```

## 🔄 Процесс синхронизации

```
GitHub Secrets (encrypted at rest)
    ↓
GitHub Actions Workflow (при деплое)
    ↓
Kubernetes Secret (canton-otc-secrets)
    ↓
Pod Environment Variables
```

## 📝 Ручная синхронизация (если нужно)

Если нужно обновить секреты без полного деплоя:

```bash
# 1. Получить секреты из GitHub (через GitHub CLI)
gh secret list

# 2. Создать временный скрипт для синхронизации
cat > /tmp/sync-secrets.sh << 'EOF'
#!/bin/bash
set -e

NAMESPACE="canton-otc"
SECRET_NAME="canton-otc-secrets"

# Получаем секреты из GitHub и создаем Kubernetes Secret
kubectl create secret generic "$SECRET_NAME" \
  --namespace="$NAMESPACE" \
  --from-literal=GOOGLE_SHEET_ID="$(gh secret get GOOGLE_SHEET_ID)" \
  --from-literal=TELEGRAM_BOT_TOKEN="$(gh secret get TELEGRAM_BOT_TOKEN)" \
  --from-literal=TELEGRAM_CHAT_ID="$(gh secret get TELEGRAM_CHAT_ID)" \
  --from-literal=TELEGRAM_CLIENT_GROUP_CHAT_ID="$(gh secret get TELEGRAM_CLIENT_GROUP_CHAT_ID)" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "✅ Секреты синхронизированы"
EOF

chmod +x /tmp/sync-secrets.sh
/tmp/sync-secrets.sh
```

## 🚀 Альтернатива: External Secrets Operator

Для автоматической синхронизации без деплоя можно использовать External Secrets Operator, но это требует:

1. **GitHub App** (не Personal Access Token) - более безопасно
2. **Установка оператора** в кластере
3. **Дополнительная конфигурация**

### Когда использовать External Secrets Operator:

- ✅ Нужна автоматическая синхронизация каждые N минут/часов
- ✅ Много окружений (dev, stage, prod)
- ✅ Частые изменения секретов без деплоя

### Когда использовать GitHub Actions:

- ✅ Production с редкими изменениями секретов
- ✅ Секреты обновляются вместе с кодом
- ✅ Простота и надежность важнее автоматизации

## 📊 Текущий статус

**Production (canton-otc namespace):**
- ✅ Использует GitHub Actions workflow
- ✅ Секреты синхронизируются при каждом деплое
- ✅ Все секреты хранятся в GitHub Secrets

**Minimal-stage (canton-otc-minimal-stage namespace):**
- ✅ Использует External Secrets Operator
- ✅ Автоматическая синхронизация каждые 30 секунд
- ⚠️ Требует настройки GitHub App

## 🔒 Безопасность

### Best Practices соблюдены:

1. ✅ **Секреты не в Git** - только в GitHub Secrets
2. ✅ **Шифрование** - секреты зашифрованы в GitHub и Kubernetes
3. ✅ **RBAC** - ограниченный доступ к секретам в Kubernetes
4. ✅ **Аудит** - все изменения через GitHub Actions logs
5. ✅ **Ротация** - легко обновить секреты через GitHub UI/CLI

## 📋 Чек-лист для добавления нового секрета

1. [ ] Добавить секрет в GitHub Secrets через UI или CLI
2. [ ] Добавить секрет в `.github/workflows/simple-deploy.yml` в секцию `env:`
3. [ ] Добавить секрет в `config/kubernetes/k8s/secret.template.yaml`
4. [ ] Добавить секрет в `config/kubernetes/k8s/deployment.yaml` как `secretKeyRef`
5. [ ] Протестировать деплой
6. [ ] Проверить что секрет доступен в поде: `kubectl exec -n canton-otc deployment/canton-otc -- env | grep SECRET_NAME`

## 🛠️ Полезные команды

```bash
# Проверить секреты в GitHub
gh secret list

# Проверить секреты в Kubernetes
kubectl get secret canton-otc-secrets -n canton-otc -o jsonpath='{.data}' | jq 'keys'

# Проверить секреты в работающем поде
kubectl exec -n canton-otc deployment/canton-otc -- env | grep -E "GOOGLE|TELEGRAM|SMTP"

# Обновить секрет в GitHub
gh secret set SECRET_NAME --body "new_value"

# Принудительно синхронизировать (запустить деплой)
gh workflow run simple-deploy.yml --ref main
```

## 📚 Дополнительные ресурсы

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Kubernetes Secrets Best Practices](https://kubernetes.io/docs/concepts/configuration/secret/#best-practices)
- [External Secrets Operator](https://external-secrets.io/)
