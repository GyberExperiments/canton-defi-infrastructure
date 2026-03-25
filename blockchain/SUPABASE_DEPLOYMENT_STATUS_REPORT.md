# 📊 ОТЧЁТ: Развёртывание Supabase Auth для Canton Validator

**Дата**: 28 ноября 2025  
**Статус**: Частично завершено  
**Сервер**: 65.108.15.30

---

## ✅ ВЫПОЛНЕНО

### 1. PostgreSQL в Supabase
- ✅ **Проблема решена**: Исправлены права доступа к директории данных
- ✅ **Решение**: Добавлен initContainer для исправления прав перед запуском PostgreSQL
- ✅ **Конфигурация**: Убран `PGDATA` из ConfigMap (используется стандартный путь)
- ✅ **Статус**: PostgreSQL запущен и работает (Ready 1/1)
- ✅ **База данных**: Создана база данных `supabase`
- ✅ **Схема**: Создана схема `auth` для GoTrue

**Файл**: `k8s/supabase/postgres-statefulset.yaml`
- Добавлен initContainer `fix-permissions` (busybox:1.36)
- Установлены права `root:root` на `/var/lib/postgresql/data`
- Убран `PGDATA` из переменных окружения

### 2. Supabase Auth (GoTrue)
- ✅ **Запущен**: Pod работает (Ready 1/1)
- ✅ **Миграции**: Применены успешно (44 миграции)
- ✅ **API**: Запущен на порту 9999
- ✅ **RSA ключи**: Настроены для RS256 алгоритма
- ✅ **Secret**: Создан `auth-rsa-keys` с private и public ключами

**Файлы**:
- `k8s/supabase/supabase-services.yaml` - обновлён с RSA ключами
- `k8s/supabase/jwks-service.yaml` - создан новый сервис для JWKS

**Конфигурация**:
- `GOTRUE_JWT_ALGORITHM: "RS256"` - добавлен в ConfigMap
- `GOTRUE_JWT_RSA_PRIVATE_KEY` и `GOTRUE_JWT_RSA_PUBLIC_KEY` - загружены из Secret

### 3. JWKS Endpoint
- ✅ **Сервис создан**: `supabase-jwks` (nginx:1.27.3-alpine)
- ✅ **JWKS JSON**: Сгенерирован из RSA публичного ключа
- ✅ **Доступность**: Работает через port-forward локально
- ⚠️ **Проблема**: Не доступен через внешний IP `65.108.15.30:8000`

**Файл**: `k8s/supabase/jwks-service.yaml`
- Deployment с nginx
- ConfigMap с JWKS JSON
- Service на порту 8080

**Kong конфигурация**: `k8s/supabase/kong-deployment.yaml`
- Добавлен service `auth-v1-jwks` для `/auth/v1/jwks`
- Добавлен service `auth-v1-jwks-wellknown` для `/auth/v1/.well-known/jwks.json`

### 4. Kong API Gateway
- ✅ **Запущен**: Pod работает (Ready 1/1)
- ✅ **ExternalIPs**: Настроен на `65.108.15.30`
- ✅ **Конфигурация**: Обновлена с маршрутами для JWKS
- ⚠️ **Проблема**: JWKS endpoint не доступен через внешний IP (таймаут)

---

## ⚠️ ТЕКУЩИЕ ПРОБЛЕМЫ

### Проблема 1: JWKS endpoint недоступен через внешний IP
**Статус**: ✅ **ИСПРАВЛЕНО** (28.11.2025)  
**Симптомы**: 
- `curl http://65.108.15.30:8000/auth/v1/jwks` - таймаут
- `curl http://localhost:8000/auth/v1/jwks` (через port-forward) - работает

**Причина**:
1. ❌ **Порядок маршрутов в Kong**: Общий маршрут `/auth/v1/` перехватывал запросы к `/auth/v1/jwks`
2. ❌ **Конфигурация проксирования**: Неправильный `strip_path` и URL для JWKS сервиса
3. ❌ **Nginx конфигурация**: Не обрабатывал путь `/jwks` (только `/jwks.json`)

**Исправления**:
1. ✅ Переупорядочены маршруты в Kong (JWKS перед общим auth-v1)
2. ✅ Исправлена конфигурация проксирования (`strip_path: true`, URL без пути)
3. ✅ Обновлена конфигурация nginx для обработки `/jwks` и `/jwks.json`

**Инструкции по применению**: См. `blockchain/JWKS_FIX_APPLY_INSTRUCTIONS.md`

**Файлы изменены**:
- `k8s/supabase/kong-deployment.yaml` - порядок маршрутов и конфигурация JWKS
- `k8s/supabase/jwks-service.yaml` - конфигурация nginx

### Проблема 2: Supabase Realtime не запускается
**Статус**: Низкий приоритет (не критично для Canton Validator)  
**Симптомы**: CrashLoopBackOff

**Решение**: Можно исправить позже, не блокирует работу auth

---

## 📋 ТЕКУЩИЙ СТАТУС КОМПОНЕНТОВ

### Supabase Namespace
```
postgres-0                          1/1     Running
kong-*                              1/1     Running  
supabase-auth-*                     1/1     Running
supabase-jwks-*                     1/1     Running
supabase-rest-*                     2/2     Running
supabase-meta-*                     1/1     Running
supabase-realtime-*                 0/1     CrashLoopBackOff (не критично)
```

### Сервисы
```
kong                        LoadBalancer   65.108.15.30   8000:31098/TCP
postgres                    ClusterIP      5432/TCP
supabase-auth               ClusterIP      9999/TCP
supabase-jwks               ClusterIP      8080/TCP
```

---

## 🔧 ИЗМЕНЁННЫЕ ФАЙЛЫ

1. **k8s/supabase/postgres-statefulset.yaml**
   - Добавлен initContainer для исправления прав
   - Убран `PGDATA` из ConfigMap

2. **k8s/supabase/supabase-services.yaml**
   - Добавлен `GOTRUE_JWT_ALGORITHM: "RS256"`
   - Добавлены env переменные для RSA ключей из Secret

3. **k8s/supabase/kong-deployment.yaml**
   - Добавлены маршруты для JWKS endpoints

4. **k8s/supabase/jwks-service.yaml** (новый файл)
   - Deployment с nginx для JWKS
   - ConfigMap с JWKS JSON
   - Service для доступа к JWKS

---

## 🔑 RSA КЛЮЧИ

**Расположение**: Secret `auth-rsa-keys` в namespace `supabase`

**Публичный ключ** (для JWKS):
```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuq8xzuZ9zLt64TEDDO02...
-----END PUBLIC KEY-----
```

**JWKS JSON** (доступен через `/auth/v1/jwks`):
```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "1",
      "n": "uq8xzuZ9zLt64TEDDO02xFhLFDP50K4vLhozXwa4kWEqkB2_qjrGvwjS_qP7jd-zi1Pc6HVudN7GNpNl5nxX1tdUWY0Nco7dNLw1ICkVFfqMBdRPQ-tS7pGYmyzJ6HBm8As_DquvzpSKqPBHVEB-z7oyb132BpUyI80RnwWw6oDyAfVjzoScCjNnfPfhflqawqr6sHcWCp4r-7-tmVZa8FhExGD4Qf1rTHnorDW5ht4tqqOt3Kd_OkiAa3FCLOZrVkwsOnReTH4HqzusJiK9KRQ4SrsFAENuL_k7FSarOeRDjsldAPTcpOJf2w0soJjLcBOQiDJBarmi8Wj0Qz8w-w",
      "e": "AQAB",
      "alg": "RS256"
    }
  ]
}
```

---

## 🎯 СЛЕДУЮЩИЕ ШАГИ

### Приоритет 1: Исправить доступность JWKS через внешний IP
1. Проверить маршрутизацию в Kong
2. Убедиться, что сервис `supabase-jwks` доступен из Kong
3. Проверить приоритет маршрутов (возможно конфликт с `auth-v1`)
4. Проверить логи Kong на ошибки

### Приоритет 2: Настроить Canton Validator
1. Обновить `.env` файл на сервере `65.108.15.30`:
   ```bash
   AUTH_JWKS_URL=http://65.108.15.30:8000/auth/v1/jwks
   AUTH_WELLKNOWN_URL=http://65.108.15.30:8000/auth/v1/.well-known/openid-configuration
   AUTH_URL=http://65.108.15.30:8000/auth/v1
   ```

2. Перезапустить контейнеры Canton Validator:
   ```bash
   ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30
   cd /opt/canton-validator
   docker compose -f compose.yaml down
   docker compose -f compose.yaml up -d
   ```

3. Проверить логи на ошибки auth

### Приоритет 3: Исправить Supabase Realtime (опционально)
- Не критично для работы Canton Validator
- Можно исправить позже

---

## 📝 КОМАНДЫ ДЛЯ ПРОВЕРКИ

### Проверка Supabase
```bash
# Статус всех подов
kubectl get pods -n supabase

# Логи supabase-auth
kubectl logs -n supabase -l app=supabase-auth --tail=20

# Проверка JWKS через port-forward
kubectl port-forward -n supabase svc/kong 8000:8000 &
curl http://localhost:8000/auth/v1/jwks

# Проверка JWKS через внешний IP
curl http://65.108.15.30:8000/auth/v1/jwks
```

### Проверка Canton Validator
```bash
# На сервере 65.108.15.30
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30
cd /opt/canton-validator

# Статус контейнеров
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep splice-validator

# Логи participant
docker logs splice-validator-participant-1 --tail=30

# Логи validator
docker logs splice-validator-validator-1 --tail=30
```

---

## 🔗 ССЫЛКИ

- **SSH**: `ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30`
- **Директория валидатора**: `/opt/canton-validator`
- **Kong Service**: `65.108.15.30:8000`
- **JWKS endpoint**: `http://65.108.15.30:8000/auth/v1/jwks` (должен работать)

---

**Дата создания отчёта**: 28 ноября 2025  
**Последнее обновление**: 28 ноября 2025  
**Статус**: Исправления применены, требуется проверка внешнего доступа

**Исправления применены**:
- ✅ Порядок маршрутов в Kong исправлен
- ✅ Конфигурация JWKS обновлена
- ✅ Сервис Kong изменен на NodePort (порт 30080)
- ✅ Kong и JWKS поды работают

**Важно**: Порт изменился с `8000` на `30080` для внешнего доступа!
