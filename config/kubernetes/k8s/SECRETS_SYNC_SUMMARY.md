# 🔐 Итоговая документация: Синхронизация секретов

## ✅ Best Practice решение для Production

Для production окружения **рекомендуется использовать GitHub Actions workflow** для синхронизации секретов. Это соответствует industry best practices и уже реализовано в проекте.

## 🏗️ Текущая архитектура

### Production (canton-otc namespace)

**Механизм:** GitHub Actions Workflow → Kubernetes Secrets

**Файлы:**
- `.github/workflows/simple-deploy.yml` - автоматическая синхронизация при деплое
- `config/kubernetes/k8s/secret.template.yaml` - шаблон секретов

**Процесс:**
1. Секреты хранятся в GitHub Secrets (encrypted at rest)
2. При деплое GitHub Actions получает секреты
3. Создается Kubernetes Secret через `envsubst` и `secret.template.yaml`
4. Секреты применяются в кластер

**Преимущества:**
- ✅ Single Source of Truth (GitHub Secrets)
- ✅ Автоматическая синхронизация при деплое
- ✅ Безопасность (секреты не в Git)
- ✅ Аудит через GitHub Actions logs
- ✅ Простота и надежность

## 🔄 Как обновить секреты

### Вариант 1: Через GitHub Actions (рекомендуется)

```bash
# 1. Обновить секрет в GitHub
gh secret set GOOGLE_SHEET_ID --body "new_value"

# 2. Запустить деплой (секреты синхронизируются автоматически)
gh workflow run simple-deploy.yml --ref main
```

### Вариант 2: Ручное обновление через kubectl

Если нужно обновить секрет без деплоя:

```bash
# Обновить конкретный секрет
kubectl create secret generic canton-otc-secrets \
  --namespace=canton-otc \
  --from-literal=GOOGLE_SHEET_ID="new_value" \
  --dry-run=client -o yaml | kubectl apply -f -

# Перезапустить поды для применения
kubectl rollout restart deployment/canton-otc -n canton-otc
```

## 📋 Текущая проблема и решение

### Проблема
В секрете `canton-otc-secrets` отсутствуют ключи:
- `GOOGLE_SHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_CLIENT_GROUP_CHAT_ID`
- И другие...

### Решение

**Вариант 1: Запустить GitHub Actions workflow (лучший)**

```bash
# Запустить деплой который синхронизирует все секреты
gh workflow run simple-deploy.yml --ref main
```

**Вариант 2: Использовать значения из работающего пода**

```bash
# Получить значения из работающего пода
kubectl exec -n canton-otc deployment/canton-otc -- env | grep -E "GOOGLE_SHEET_ID|TELEGRAM_BOT_TOKEN" > /tmp/current-secrets.txt

# Создать секрет вручную (скопировать значения из файла)
kubectl create secret generic canton-otc-secrets \
  --namespace=canton-otc \
  --from-env-file=/tmp/current-secrets.txt \
  --dry-run=client -o yaml | kubectl apply -f -
```

**Вариант 3: Использовать External Secrets Operator (для будущего)**

Если нужна автоматическая синхронизация без деплоя, можно настроить External Secrets Operator, но это требует:
- Настройку GitHub App (не PAT)
- Установку оператора в кластере
- Дополнительную конфигурацию

## 🚀 Рекомендуемые действия

1. **Немедленно:** Запустить GitHub Actions workflow для синхронизации секретов
2. **Проверить:** Что все секреты доступны в поде
3. **Документировать:** Процесс обновления секретов для команды

## 📚 Дополнительная документация

- `SECRETS_SYNC_BEST_PRACTICES.md` - детальная документация по best practices
- `.github/workflows/simple-deploy.yml` - workflow для синхронизации
- `config/kubernetes/k8s/secret.template.yaml` - шаблон секретов
