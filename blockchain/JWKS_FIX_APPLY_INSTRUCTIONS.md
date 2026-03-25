# 🔧 ИНСТРУКЦИИ: Применение исправлений JWKS

**Дата**: 28 ноября 2025  
**Статус**: Готово к применению

---

## ✅ ЧТО ИСПРАВЛЕНО

### 1. Порядок маршрутов в Kong
**Проблема**: Общий маршрут `/auth/v1/` перехватывал запросы к `/auth/v1/jwks`

**Решение**: 
- Специфичные маршруты JWKS перемещены **ПЕРЕД** общим маршрутом `auth-v1`
- Порядок теперь: JWKS → специфичные auth → общий auth-v1

### 2. Конфигурация проксирования JWKS
**Проблема**: 
- `strip_path: false` + URL `http://supabase-jwks:8080/jwks.json` → неправильный путь
- Nginx не обрабатывал `/jwks` (только `/jwks.json`)

**Решение**:
- Изменено на `strip_path: true` + URL `http://supabase-jwks:8080`
- Nginx теперь обрабатывает и `/jwks` и `/jwks.json` через regex

---

## 🚀 КОМАНДЫ ДЛЯ ПРИМЕНЕНИЯ

### Шаг 1: Применить исправления Kong
```bash
kubectl apply -f k8s/supabase/kong-deployment.yaml
```

### Шаг 2: Перезапустить Kong для применения новой конфигурации
```bash
kubectl rollout restart deployment/kong -n supabase
```

### Шаг 3: Применить исправления JWKS сервиса
```bash
kubectl apply -f k8s/supabase/jwks-service.yaml
```

### Шаг 4: Перезапустить JWKS сервис
```bash
kubectl rollout restart deployment/supabase-jwks -n supabase
```

### Шаг 5: Дождаться готовности подов
```bash
kubectl wait --for=condition=ready pod -l app=kong -n supabase --timeout=60s
kubectl wait --for=condition=ready pod -l app=supabase-jwks -n supabase --timeout=60s
```

---

## 🔍 ПРОВЕРКА

### 1. Проверить статус подов
```bash
kubectl get pods -n supabase -l 'app in (kong,supabase-jwks)'
```

Ожидаемый результат:
```
NAME                              READY   STATUS    RESTARTS   AGE
kong-xxxxx                         1/1     Running   0          Xm
supabase-jwks-xxxxx                1/1     Running   0          Xm
```

### 2. Проверить доступность JWKS через port-forward (локально)
```bash
kubectl port-forward -n supabase svc/kong 8000:8000 > /dev/null 2>&1 &
sleep 3
curl -v http://localhost:8000/auth/v1/jwks
pkill -f "port-forward.*kong"
```

**Ожидаемый результат**: HTTP 200 с JSON ключами

### 3. Проверить доступность JWKS через внешний IP
```bash
curl -v --max-time 10 http://65.108.15.30:8000/auth/v1/jwks
```

**Ожидаемый результат**: HTTP 200 с JSON ключами (больше не таймаут!)

### 4. Проверить логи Kong на ошибки
```bash
kubectl logs -n supabase -l app=kong --tail=50 | grep -i "jwks\|error"
```

**Ожидаемый результат**: Нет ошибок, видны успешные запросы к JWKS

### 5. Проверить доступность из Kong пода к JWKS сервису
```bash
KONG_POD=$(kubectl get pod -n supabase -l app=kong -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n supabase $KONG_POD -- wget -qO- http://supabase-jwks:8080/jwks
```

**Ожидаемый результат**: JSON с ключами

---

## ⚠️ ВАЖНО

1. **Порядок маршрутов критичен**: Специфичные маршруты должны быть ПЕРЕД общими
2. **После изменений Kong нужно перезапустить**: Новая конфигурация применяется при старте
3. **Проверять каждый шаг**: Не переходить к следующему, пока не работает текущий

---

## 📝 ИЗМЕНЁННЫЕ ФАЙЛЫ

1. **`k8s/supabase/kong-deployment.yaml`**
   - Переупорядочены маршруты (JWKS перед auth-v1)
   - Исправлена конфигурация проксирования JWKS (`strip_path: true`, URL без пути)

2. **`k8s/supabase/jwks-service.yaml`**
   - Обновлена конфигурация nginx для обработки `/jwks` и `/jwks.json`

---

## 🎯 СЛЕДУЮЩИЕ ШАГИ

После успешной проверки JWKS:

1. **Обновить .env Canton Validator**:
   ```bash
   ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30
   cd /opt/canton-validator
   
   # Backup
   cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
   
   # Обновить AUTH переменные
   sed -i 's|AUTH_JWKS_URL=.*|AUTH_JWKS_URL=http://65.108.15.30:8000/auth/v1/jwks|g' .env
   sed -i 's|AUTH_WELLKNOWN_URL=.*|AUTH_WELLKNOWN_URL=http://65.108.15.30:8000/auth/v1/.well-known/jwks.json|g' .env
   sed -i 's|AUTH_URL=.*|AUTH_URL=http://65.108.15.30:8000/auth/v1|g' .env
   
   # Проверить
   cat .env | grep -E '(AUTH_JWKS_URL|AUTH_WELLKNOWN_URL|AUTH_URL)'
   ```

2. **Перезапустить Canton Validator**:
   ```bash
   cd /opt/canton-validator
   docker compose -f compose.yaml down
   docker compose -f compose.yaml up -d
   sleep 30
   ```

3. **Проверить логи Canton**:
   ```bash
   docker logs splice-validator-participant-1 2>&1 | grep -i 'auth\|jwks\|error' | tail -10
   docker logs splice-validator-validator-1 2>&1 | grep -i 'auth\|jwks\|error' | tail -10
   ```

---

**Дата создания**: 28 ноября 2025  
**Статус**: Готово к применению





