# 🔐 Получение Supabase Credentials из Kubernetes

## 📍 Где хранятся credentials

Supabase развернут в Kubernetes в namespace `supabase`. Credentials хранятся в:

1. **Secret `postgres-secret`** - содержит `SERVICE_ROLE_KEY` и `ANON_KEY`
2. **ConfigMap `supabase-config`** (если существует) - может содержать те же ключи
3. **Environment variables** в postgres pod

## 🚀 Команды для получения

### Вариант 1: Из Secret (рекомендуется)

```bash
# Получить SERVICE_ROLE_KEY
kubectl get secret postgres-secret -n supabase -o jsonpath='{.data.SERVICE_ROLE_KEY}' | base64 -d && echo

# Получить ANON_KEY (для frontend, опционально)
kubectl get secret postgres-secret -n supabase -o jsonpath='{.data.ANON_KEY}' | base64 -d && echo
```

### Вариант 2: Из ConfigMap (если существует)

```bash
# Проверить существует ли ConfigMap
kubectl get configmap supabase-config -n supabase

# Если существует, получить ключи
kubectl get configmap supabase-config -n supabase -o jsonpath='{.data.SERVICE_ROLE_KEY}' && echo
kubectl get configmap supabase-config -n supabase -o jsonpath='{.data.ANON_KEY}' && echo
```

### Вариант 3: Из environment variables pod

```bash
# Получить SERVICE_ROLE_KEY из postgres pod
kubectl exec -it postgres-0 -n supabase -- env | grep SERVICE_ROLE_KEY

# Получить ANON_KEY
kubectl exec -it postgres-0 -n supabase -- env | grep ANON_KEY
```

## 📝 Пример значений (из postgres-statefulset.yaml)

**ВНИМАНИЕ:** Это примеры для localhost. Production значения могут отличаться!

```
SERVICE_ROLE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsaG9zdCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTk1NzM0NTIwMH0.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q

ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsaG9zdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE5NTczNDUyMDB9.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE
```

## ✅ Добавление в GitHub Secrets

После получения значений:

```bash
# Добавить SERVICE_ROLE_KEY
gh secret set SUPABASE_SERVICE_ROLE_KEY -b "<полученное_значение>"

# (Опционально) Добавить ANON_KEY для frontend
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY -b "<полученное_значение>"

# (Опционально) Добавить URL (если нужен явный)
gh secret set NEXT_PUBLIC_SUPABASE_URL -b "https://api.1otc.cc"
```

## 🔍 Проверка

```bash
# Проверить что секреты добавлены
gh secret list | grep SUPABASE

# Проверить что они используются в workflow
grep -r "SUPABASE" .github/workflows/
```

## ⚠️ Важно

1. **SERVICE_ROLE_KEY** дает полный доступ к базе - хранить в секретах!
2. Проверить что значения из production, а не из примеров
3. После добавления в GitHub Secrets они автоматически синхронизируются в Kubernetes через External Secrets Operator (для minimal-stage)



