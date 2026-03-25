# 🔐 Проверка Supabase Credentials

## 📍 Текущая конфигурация

### Supabase URL
- **Production:** `https://api.1otc.cc` (из ingress.yaml)
- **Fallback в коде:** `http://api.1otc.cc` (если переменная не задана)
- **Источник:** `k8s/supabase/ingress.yaml` - Ingress настроен на `api.1otc.cc`

### Service Role Key
- **Где хранится:** В ConfigMap `supabase-config` в namespace `supabase`
- **Как получить:**
  ```bash
  kubectl get configmap supabase-config -n supabase -o jsonpath='{.data.SERVICE_ROLE_KEY}'
  ```

### Anon Key (для frontend)
- **Где хранится:** В ConfigMap `supabase-config` в namespace `supabase`
- **Как получить:**
  ```bash
  kubectl get configmap supabase-config -n supabase -o jsonpath='{.data.ANON_KEY}'
  ```

## ✅ Рекомендации

### Для production/main окружения:

1. **NEXT_PUBLIC_SUPABASE_URL:**
   - Значение: `https://api.1otc.cc`
   - Уже есть fallback в коде, но лучше задать явно

2. **SUPABASE_SERVICE_ROLE_KEY:**
   - Получить из Kubernetes:
     ```bash
     kubectl get configmap supabase-config -n supabase -o jsonpath='{.data.SERVICE_ROLE_KEY}'
     ```
   - Добавить в GitHub Secrets как `SUPABASE_SERVICE_ROLE_KEY`

3. **NEXT_PUBLIC_SUPABASE_ANON_KEY** (опционально, для frontend):
   - Получить из Kubernetes:
     ```bash
     kubectl get configmap supabase-config -n supabase -o jsonpath='{.data.ANON_KEY}'
     ```
   - Добавить в GitHub Secrets как `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 🔧 Команды для получения credentials

```bash
# Получить Service Role Key
kubectl get configmap supabase-config -n supabase -o jsonpath='{.data.SERVICE_ROLE_KEY}' && echo

# Получить Anon Key
kubectl get configmap supabase-config -n supabase -o jsonpath='{.data.ANON_KEY}' && echo

# Получить все ключи из ConfigMap
kubectl get configmap supabase-config -n supabase -o yaml
```

## 📝 Текущий статус в коде

**Файл:** `src/lib/supabase.ts`
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://api.1otc.cc'
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
```

**Вывод:**
- ✅ URL имеет fallback на `http://api.1otc.cc` (должен быть `https://`)
- ⚠️ SERVICE_ROLE_KEY не имеет fallback (нужно добавить в GitHub Secrets)

## 🚀 Действия

1. ✅ Убрать `TELEGRAM_PUBLIC_CHANNEL_ID` из всех конфигураций (уже сделано)
2. ⚠️ Получить `SUPABASE_SERVICE_ROLE_KEY` из Kubernetes и добавить в GitHub Secrets
3. ⚠️ Убедиться что `NEXT_PUBLIC_SUPABASE_URL` установлен в `https://api.1otc.cc` (не `http://`)
