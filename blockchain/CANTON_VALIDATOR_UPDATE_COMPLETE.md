# ✅ ОБНОВЛЕНИЕ CANTON VALIDATOR ЗАВЕРШЕНО

**Дата**: 28 ноября 2025  
**Статус**: .env обновлен, контейнеры перезапущены

---

## ✅ ВЫПОЛНЕНО

### 1. Обновлен .env файл Canton Validator
- ✅ Создан backup: `.env.backup.YYYYMMDD_HHMMSS`
- ✅ Обновлены AUTH переменные с новым портом `30080`:
  - `AUTH_JWKS_URL=http://65.108.15.30:30080/auth/v1/jwks`
  - `AUTH_WELLKNOWN_URL=http://65.108.15.30:30080/auth/v1/.well-known/jwks.json`
  - `AUTH_URL=http://65.108.15.30:30080/auth/v1`

### 2. Перезапущены контейнеры Canton Validator
- ✅ Контейнеры остановлены
- ✅ Контейнеры запущены заново
- ✅ Статус: контейнеры запускаются

---

## 📊 ТЕКУЩИЙ СТАТУС

### Контейнеры
```
splice-validator-ans-web-ui-1      Up (health: starting)
splice-validator-wallet-web-ui-1   Up (health: starting)
[participant и validator контейнеры запускаются]
```

### Конфигурация
- **AUTH_JWKS_URL**: `http://65.108.15.30:30080/auth/v1/jwks`
- **AUTH_WELLKNOWN_URL**: `http://65.108.15.30:30080/auth/v1/.well-known/jwks.json`
- **AUTH_URL**: `http://65.108.15.30:30080/auth/v1`

---

## ⚠️ ИЗВЕСТНЫЕ ПРОБЛЕМЫ

### 1. Внешний доступ к JWKS через порт 30080
**Статус**: Требует настройки  
**Проблема**: 
- С внешнего IP (`65.108.15.30:30080`) - таймаут
- С локального хоста на сервере - возвращается HTML вместо JSON

**Возможные причины**:
1. NodePort в K3s перенаправляет на localhost (проблема маршрутизации)
2. Firewall может блокировать порт (хотя ufw inactive)
3. Проблема с конфигурацией Kong маршрутизации

**Решения**:
- Проверить iptables правила для порта 30080
- Возможно, использовать другой подход (hostPort, LoadBalancer)
- Проверить логи Kong на ошибки маршрутизации

### 2. Имена контейнеров изменились
**Статус**: Не критично  
**Проблема**: Контейнеры имеют хеш-префиксы в именах

**Решение**: Использовать `docker ps` для получения актуальных имен

---

## 🔍 ПРОВЕРКА

### 1. Проверить статус контейнеров
```bash
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30
cd /opt/canton-validator
docker compose -f compose.yaml ps
```

### 2. Проверить логи participant
```bash
PARTICIPANT=$(docker ps --format '{{.Names}}' | grep participant | head -1)
docker logs $PARTICIPANT 2>&1 | grep -i 'auth\|jwks\|error' | tail -20
```

### 3. Проверить логи validator
```bash
VALIDATOR=$(docker ps --format '{{.Names}}' | grep validator | grep -v web-ui | head -1)
docker logs $VALIDATOR 2>&1 | tail -50
```

### 4. Проверить доступность JWKS (локально на сервере)
```bash
curl -v http://127.0.0.1:30080/auth/v1/jwks
# Должен возвращать JSON, но сейчас возвращает HTML
```

---

## 🎯 СЛЕДУЮЩИЕ ШАГИ

### Приоритет 1: Исправить доступность JWKS
1. Проверить, почему через localhost:30080 возвращается HTML вместо JSON
2. Проверить логи Kong на ошибки маршрутизации
3. Возможно, изменить конфигурацию Kong или использовать другой подход

### Приоритет 2: Проверить работу Canton Validator
1. Дождаться полного запуска контейнеров
2. Проверить логи на ошибки auth
3. Убедиться, что нет ошибок "empty string" для auth

### Приоритет 3: Настроить внешний доступ
1. Если локально работает - настроить firewall/iptables для внешнего доступа
2. Или использовать другой порт/подход

---

## 📝 КОМАНДЫ ДЛЯ ДИАГНОСТИКИ

### Проверка Kong маршрутизации
```bash
# Из кластера
kubectl logs -n supabase -l app=kong --tail=50 | grep -i "jwks\|auth-v1"

# Проверка конфигурации
kubectl exec -n supabase $(kubectl get pod -n supabase -l app=kong -o jsonpath='{.items[0].metadata.name}') -- cat /var/lib/kong/kong.yml | grep -A 10 "auth-v1-jwks"
```

### Проверка NodePort
```bash
# На сервере
iptables -t nat -L -n | grep 30080
ss -tlnp | grep 30080
```

### Проверка Canton Validator
```bash
# На сервере
cd /opt/canton-validator
docker compose -f compose.yaml logs participant | tail -50
docker compose -f compose.yaml logs validator | tail -50
```

---

**Дата создания**: 28 ноября 2025  
**Статус**: .env обновлен, контейнеры перезапущены, требуется исправление доступа к JWKS





