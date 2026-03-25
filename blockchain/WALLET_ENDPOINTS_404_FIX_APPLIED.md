# ✅ ИСПРАВЛЕНИЕ: Wallet Endpoints 404 - Решение применено

**Дата:** 2025-11-29  
**Статус:** Исправление применено  
**Приоритет:** КРИТИЧЕСКИЙ

---

## 🔍 ПРОБЛЕМА

Wallet endpoints (`/api/validator/v0/wallet/*`, `/api/validator/v0/register`) возвращали 404, несмотря на то, что:
- HTTP REST API работал частично (endpoint `/api/validator/version` отвечал)
- Конфигурация показывала `enable-wallet=true`
- Переменные окружения были настроены правильно

## 🎯 КОРНЕВАЯ ПРИЧИНА

Wallet функциональность не включалась автоматически только через переменные окружения. Требовалась явная конфигурация через `ADDITIONAL_CONFIG` для настройки Canton validator-app.

## ✅ РЕШЕНИЕ

Добавлена конфигурация `ADDITIONAL_CONFIG_WALLET` в Kubernetes манифест для включения wallet endpoints через Canton конфигурацию.

### Изменения в файле:
`blockchain/k8s/canton-validator-full-stack.yaml`

Добавлено после `ADDITIONAL_CONFIG_MIGRATION_ID`:

```yaml
- name: ADDITIONAL_CONFIG_WALLET
  value: |
    canton.validator-apps.validator_backend {
      enable-wallet = true
      validator-wallet-users = [wallet-admin]
      admin-api {
        port = 5003
        address = "0.0.0.0"
      }
    }
```

## 📋 ЧТО БЫЛО ИСПРАВЛЕНО

1. ✅ Добавлена конфигурация `ADDITIONAL_CONFIG_WALLET` с параметрами:
   - `enable-wallet = true` - включает wallet функциональность
   - `validator-wallet-users = [wallet-admin]` - настраивает пользователей wallet
   - `admin-api.port = 5003` - настраивает порт HTTP REST API
   - `admin-api.address = "0.0.0.0"` - настраивает адрес для прослушивания

2. ✅ Проверено, что переменная окружения `SPLICE_APP_VALIDATOR_WALLET_USER_NAME` установлена в `wallet-admin` (уже была в манифесте)

## 🚀 ИНСТРУКЦИИ ПО ПРИМЕНЕНИЮ

### Для Kubernetes deployment:

1. **Применить обновленный манифест:**
   ```bash
   kubectl apply -f blockchain/k8s/canton-validator-full-stack.yaml
   ```

2. **Перезапустить validator-app pod:**
   ```bash
   kubectl rollout restart deployment validator -n canton-node
   # или
   kubectl delete pod -l app=validator -n canton-node
   ```

3. **Проверить логи validator-app:**
   ```bash
   kubectl logs -f deployment/validator -n canton-node | grep -i 'wallet\|endpoint\|route'
   ```

4. **Проверить, что endpoints работают:**
   ```bash
   # Проверка базового endpoint (должен работать)
   curl "http://65.108.15.30/api/validator/version"
   
   # Проверка wallet endpoints (должны работать после исправления)
   curl "http://65.108.15.30/api/validator/v0/wallet/balance" \
     -H "Authorization: Bearer <token>"
   
   curl -X POST "http://65.108.15.30/api/validator/v0/register" \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

### Для Docker Compose deployment:

Если используется Docker Compose, нужно добавить переменную окружения в `docker-compose.yml`:

```yaml
services:
  validator:
    environment:
      - ADDITIONAL_CONFIG_WALLET=|
          canton.validator-apps.validator_backend {
            enable-wallet = true
            validator-wallet-users = [wallet-admin]
            admin-api {
              port = 5003
              address = "0.0.0.0"
            }
          }
```

Затем перезапустить:
```bash
docker compose restart validator
```

## ✅ КРИТЕРИИ УСПЕХА

После применения исправления должны работать:

1. ✅ Базовый endpoint: `/api/validator/version` (уже работал)
2. ✅ Wallet endpoints: `/api/validator/v0/wallet/*` (должны работать после исправления)
3. ✅ Register endpoint: `/api/validator/v0/register` (должен работать после исправления)
4. ✅ Wallet UI должен загружаться без ошибок
5. ✅ В логах должны быть сообщения о регистрации wallet endpoints

## 🔍 ДИАГНОСТИКА

### Проверка конфигурации:

```bash
# Проверить переменные окружения в pod
kubectl exec -it deployment/validator -n canton-node -- env | grep ADDITIONAL_CONFIG_WALLET

# Проверить логи на предмет регистрации endpoints
kubectl logs deployment/validator -n canton-node | grep -i 'wallet.*endpoint\|wallet.*route\|wallet.*api'
```

### Проверка endpoints:

```bash
# Изнутри контейнера
kubectl exec -it deployment/validator -n canton-node -- \
  curl "http://localhost:5003/api/validator/v0/wallet/balance" \
    -H "Authorization: Bearer <token>"
```

## 📝 ТЕХНИЧЕСКИЕ ДЕТАЛИ

### Конфигурация Canton:

Wallet функциональность включается через Canton конфигурацию в секции `canton.validator-apps.validator_backend`:
- `enable-wallet` - включает wallet HTTP сервер и endpoints
- `validator-wallet-users` - список пользователей, которым доступен wallet
- `admin-api.port` - порт для HTTP REST API
- `admin-api.address` - адрес для прослушивания (0.0.0.0 для всех интерфейсов)

### Зависимости:

- Переменная окружения `SPLICE_APP_VALIDATOR_WALLET_USER_NAME` должна быть установлена в `wallet-admin`
- Переменная окружения `SPLICE_APP_VALIDATOR_AUTH_JWKS_URL` должна быть настроена для аутентификации
- Переменная окружения `SPLICE_APP_VALIDATOR_AUTH_AUDIENCE` должна быть установлена в `authenticated`

## ⚠️ ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **Перезапуск обязателен:** После изменения `ADDITIONAL_CONFIG` необходимо перезапустить validator-app для применения изменений.

2. **Проверка логов:** После перезапуска проверьте логи на предмет ошибок инициализации или регистрации endpoints.

3. **Аутентификация:** Wallet endpoints требуют JWT токен в заголовке `Authorization: Bearer <token>`.

4. **Порты:** Убедитесь, что порт 5003 доступен и не заблокирован firewall.

## 🔗 ССЫЛКИ

- **Документация Splice:** https://github.com/hyperledger-labs/splice
- **Validator API:** http://65.108.15.30/api/validator
- **Wallet UI:** http://65.108.15.30/wallet/

---

**Статус:** ✅ Исправление применено  
**Следующий шаг:** Применить изменения на продакшене и протестировать endpoints





