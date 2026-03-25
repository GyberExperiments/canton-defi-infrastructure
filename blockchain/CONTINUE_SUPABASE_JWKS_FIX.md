# 🚀 ПРОМПТ: Исправление JWKS Endpoint и настройка Canton Validator

**Дата создания**: 28 ноября 2025  
**Приоритет**: КРИТИЧЕСКИЙ  
**Статус**: В процессе  
**Цель**: Полностью работоспособный JWKS endpoint и запуск Canton Validator с auth

---

## 📋 КОНТЕКСТ

### Что уже сделано:
- ✅ PostgreSQL в Supabase запущен и работает
- ✅ Supabase Auth запущен и работает
- ✅ RSA ключи сгенерированы и настроены
- ✅ JWKS сервис создан и работает локально
- ✅ Kong обновлён с маршрутами для JWKS

### Текущая проблема:
- ❌ JWKS endpoint недоступен через внешний IP `65.108.15.30:8000`
- ⚠️ Работает через port-forward локально, но не через внешний IP

---

## 🎯 ЗАДАЧИ

### Задача 1: Исправить доступность JWKS через внешний IP

**Проблема**: 
```bash
curl http://65.108.15.30:8000/auth/v1/jwks
# Таймаут или ошибка подключения
```

**Но работает**:
```bash
kubectl port-forward -n supabase svc/kong 8000:8000 &
curl http://localhost:8000/auth/v1/jwks
# Возвращает JSON с ключами
```

**Что проверить**:

1. **Доступность JWKS сервиса из Kong пода**:
   ```bash
   kubectl exec -n supabase $(kubectl get pod -n supabase -l app=kong -o jsonpath='{.items[0].metadata.name}') -- \
     wget -qO- http://supabase-jwks:8080/jwks.json
   ```

2. **Логи Kong на ошибки**:
   ```bash
   kubectl logs -n supabase -l app=kong --tail=50 | grep -i "jwks\|error\|auth-v1"
   ```

3. **Конфигурация Kong маршрутов**:
   ```bash
   kubectl get configmap -n supabase kong-declarative-config -o yaml | grep -A 15 "auth-v1-jwks"
   ```

4. **Приоритет маршрутов** (возможно конфликт):
   - Маршрут `/auth/v1/` (auth-v1-all) может перехватывать `/auth/v1/jwks`
   - Нужно проверить порядок маршрутов в конфигурации

**Возможные решения**:

**Вариант A**: Изменить порядок маршрутов в Kong (более специфичные первыми)
```yaml
# В kong-deployment.yaml
# Сначала специфичные маршруты (jwks)
# Потом общий маршрут (auth-v1)
```

**Вариант B**: Использовать другой путь для JWKS (не через `/auth/v1/`)
```yaml
paths:
  - /jwks
  - /.well-known/jwks.json
```

**Вариант C**: Проверить, что Kong правильно проксирует запросы
- Проверить логи Kong при запросе
- Проверить доступность сервиса supabase-jwks

**Вариант D**: Использовать IP напрямую вместо домена
- Проверить, что externalIPs правильно настроен
- Проверить firewall/iptables на сервере

---

### Задача 2: Настроить Canton Validator для использования Supabase Auth

**После исправления JWKS**:

1. **Обновить .env файл на сервере**:
   ```bash
   ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30
   cd /opt/canton-validator
   
   # Создать backup
   cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
   
   # Обновить AUTH переменные
   sed -i 's|AUTH_JWKS_URL=.*|AUTH_JWKS_URL=http://65.108.15.30:8000/auth/v1/jwks|g' .env
   sed -i 's|AUTH_WELLKNOWN_URL=.*|AUTH_WELLKNOWN_URL=http://65.108.15.30:8000/auth/v1/.well-known/openid-configuration|g' .env
   sed -i 's|AUTH_URL=.*|AUTH_URL=http://65.108.15.30:8000/auth/v1|g' .env
   
   # Проверить изменения
   cat .env | grep -E '(AUTH_JWKS_URL|AUTH_WELLKNOWN_URL|AUTH_URL)'
   ```

2. **Перезапустить контейнеры Canton**:
   ```bash
   cd /opt/canton-validator
   docker compose -f compose.yaml down
   docker compose -f compose.yaml up -d
   sleep 30
   ```

3. **Проверить статус контейнеров**:
   ```bash
   docker ps --format 'table {{.Names}}\t{{.Status}}' | grep splice-validator
   ```

4. **Проверить логи на ошибки auth**:
   ```bash
   # Participant
   docker logs splice-validator-participant-1 2>&1 | grep -i 'auth\|jwks\|error' | tail -10
   
   # Validator
   docker logs splice-validator-validator-1 2>&1 | grep -i 'auth\|jwks\|error' | tail -10
   ```

**Ожидаемый результат**:
- Нет ошибок "empty string" для auth
- Контейнеры запускаются и работают
- Логи показывают успешное подключение к JWKS

---

## 🔍 ДИАГНОСТИЧЕСКИЕ КОМАНДЫ

### Проверка Kong и JWKS
```bash
# 1. Статус всех подов Supabase
kubectl get pods -n supabase -o wide

# 2. Проверить доступность JWKS сервиса
kubectl get svc -n supabase supabase-jwks
kubectl get pods -n supabase -l app=supabase-jwks

# 3. Проверить логи JWKS сервиса
kubectl logs -n supabase -l app=supabase-jwks --tail=20

# 4. Проверить доступность из Kong пода
KONG_POD=$(kubectl get pod -n supabase -l app=kong -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n supabase $KONG_POD -- sh -c 'wget -qO- http://supabase-jwks:8080/jwks.json || echo "ERROR"'

# 5. Проверить конфигурацию Kong
kubectl get configmap -n supabase kong-declarative-config -o yaml | grep -A 20 "auth-v1"

# 6. Проверить логи Kong при запросе
kubectl logs -n supabase -l app=kong --tail=100 | grep -i "jwks\|/auth/v1/jwks"

# 7. Проверить через port-forward (должно работать)
kubectl port-forward -n supabase svc/kong 8000:8000 > /dev/null 2>&1 &
sleep 2
curl -v http://localhost:8000/auth/v1/jwks
pkill -f "port-forward.*kong"

# 8. Проверить через внешний IP (не работает)
curl -v --max-time 10 http://65.108.15.30:8000/auth/v1/jwks
```

### Проверка Canton Validator
```bash
# На сервере 65.108.15.30
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30
cd /opt/canton-validator

# 1. Проверить текущий .env
cat .env | grep -E '(AUTH_JWKS_URL|AUTH_WELLKNOWN_URL|AUTH_URL)'

# 2. Проверить доступность JWKS с сервера
curl -v http://65.108.15.30:8000/auth/v1/jwks

# 3. Статус контейнеров
docker ps -a --format 'table {{.Names}}\t{{.Status}}' | grep splice-validator

# 4. Логи participant
docker logs splice-validator-participant-1 2>&1 | tail -30

# 5. Логи validator
docker logs splice-validator-validator-1 2>&1 | tail -30
```

---

## 📝 ФАЙЛЫ ДЛЯ ПРОВЕРКИ

### Kubernetes конфигурации:
- `k8s/supabase/kong-deployment.yaml` - конфигурация Kong с маршрутами
- `k8s/supabase/jwks-service.yaml` - JWKS сервис
- `k8s/supabase/supabase-services.yaml` - Supabase Auth конфигурация

### Canton Validator:
- `/opt/canton-validator/.env` - переменные окружения (на сервере)
- `/opt/canton-validator/compose.yaml` - Docker Compose конфигурация

---

## ⚠️ ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **Порядок маршрутов в Kong критичен**: Более специфичные маршруты должны быть первыми
2. **JWKS должен быть доступен ДО настройки Canton**: Иначе контейнеры не запустятся
3. **Проверять каждый шаг**: Не переходить к следующему, пока не работает текущий
4. **Логи - лучший друг**: Всегда проверять логи при проблемах

---

## 🎯 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

### После исправления:
- ✅ `curl http://65.108.15.30:8000/auth/v1/jwks` возвращает JSON с ключами
- ✅ Canton Validator контейнеры запускаются без ошибок auth
- ✅ Логи показывают успешное подключение к JWKS
- ✅ Все сервисы работают и доступны

---

## 🚀 ИНСТРУКЦИИ ДЛЯ AI

**Ты должен:**

1. **Диагностировать проблему с JWKS через внешний IP**
   - Проверить доступность сервиса из Kong пода
   - Проверить логи Kong на ошибки
   - Проверить приоритет маршрутов
   - Исправить проблему

2. **Проверить доступность JWKS**
   - Убедиться, что `curl http://65.108.15.30:8000/auth/v1/jwks` работает
   - Проверить, что возвращается правильный JSON

3. **Настроить Canton Validator**
   - Обновить .env файл с правильным AUTH_JWKS_URL
   - Перезапустить контейнеры
   - Проверить логи на ошибки

4. **Проверить полную работоспособность**
   - Все контейнеры Canton запущены
   - Нет ошибок auth в логах
   - Подключение к DevNet работает

**Формат работы:**
- Выполняй команды через kubectl и SSH
- Показывай результаты каждой команды
- Проверяй успешность каждого шага
- Исправляй проблемы по мере их обнаружения
- Документируй что сделано

---

**Дата создания**: 28 ноября 2025  
**Приоритет**: КРИТИЧЕСКИЙ  
**Следующий шаг**: Исправить доступность JWKS через внешний IP `65.108.15.30:8000`





