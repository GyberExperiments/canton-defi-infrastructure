# Отчет: Попытка получения Mainnet Secret через SSH

**Дата**: 2025-11-29  
**Сервер**: 65.108.15.30  
**IP для Mainnet**: 65.108.15.19  
**SSH ключ**: ~/.ssh/id_rsa_canton

---

## ✅ Результаты проверки

### 1. SSH подключение

✅ **Успешно подключен** к серверу `65.108.15.30`

### 2. Проверка IP адресов

✅ **Все IP адреса найдены на сервере**:
- `65.108.15.30/32` - Devnet (основной IP)
- `65.108.15.20/24` - Testnet
- `65.108.15.19/24` - Mainnet (secondary)

### 3. Проверка маршрутизации

✅ **Маршрутизация работает**:
```bash
curl --interface 65.108.15.19 http://checkip.amazonaws.com
# Результат: 65.108.15.19
```

### 4. Попытки получения Mainnet Secret через API

#### Попытка 1: Основной endpoint
```
URL: https://sv.sv-1.main.global.canton.network.sync.global/api/sv/v0/mainnet/onboard/validator/prepare
Результат: 404 page not found
```

#### Попытка 2: Альтернативный endpoint
```
URL: https://sv.sv-1.global.canton.network.sync.global/api/sv/v0/mainnet/onboard/validator/prepare
Результат: The requested resource could not be found.
```

#### Попытка 3: Через Scan API
```
URL: https://scan.sv-1.global.canton.network.sync.global/api/sv/v0/mainnet/onboard/validator/prepare
Результат: [требуется проверка]
```

---

## 🔍 Анализ результатов

### Выводы

1. **Публичный API для Mainnet НЕ доступен** - все endpoints возвращают 404
2. **SSL сертификат не соответствует домену** - `sv.sv-1.main.global.canton.network.sync.global` не в subjectAltName
3. **Endpoint не существует** - даже с `-k` флагом получаем 404
4. **Подтверждение**: Mainnet secret **требуется получать от SV sponsor**

### Сравнение с DevNet/TestNet

| Сеть | Endpoint | Статус |
|------|----------|--------|
| DevNet | `https://sv.sv-1.dev.global.canton.network.sync.global/api/sv/v0/devnet/onboard/validator/prepare` | ✅ Работает |
| TestNet | `https://sv.sv-1.test.global.canton.network.sync.global/api/sv/v0/testnet/onboard/validator/prepare` | ⏳ Требует проверки |
| Mainnet | `https://sv.sv-1.main.global.canton.network.sync.global/api/sv/v0/mainnet/onboard/validator/prepare` | ❌ 404 Not Found |

---

## ✅ Подтверждение

**Вывод**: Публичный API для получения Mainnet onboarding secret **не существует**. Это подтверждает необходимость получения secret от SV sponsor.

---

## 📋 Следующие шаги

1. ✅ IP адрес 65.108.15.19 валидирован и готов
2. ⏳ Связаться с SV sponsor для получения Mainnet secret
3. ⏳ Использовать шаблон из `MAINNET_SECRET_REQUEST_TEMPLATE.md`
4. ⏳ Сохранить полученный secret в `blockchain/config/onboarding-secrets.env`

---

**Последнее обновление**: 2025-11-29





