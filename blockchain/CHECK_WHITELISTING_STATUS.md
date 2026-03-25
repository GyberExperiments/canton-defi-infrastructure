# Проверка статуса whitelisting для Testnet и Mainnet

## 📋 Текущий статус

### Testnet (65.108.15.20)

**Статус маршрутизации**: ✅ Работает правильно  
**Статус whitelisting**: ⏳ Требуется проверка

**Информация для SV sponsor:**
- **IP адрес**: 65.108.15.20
- **Сеть**: Testnet
- **SV Sponsor**: GSF (Global Synchronizer Foundation)
- **Organization**: TECH HY
- **Статус проверки**: API timeout (возможно IP не в whitelist у всех SV)

**Как проверить:**
```bash
# Запустить проверку валидации
kubectl apply -f blockchain/k8s/ip-validation-testnet.yaml
kubectl logs -l job-name=ip-validation-checker-testnet -f

# Или проверить напрямую с сервера
ssh root@65.108.15.30
curl --interface 65.108.15.20 https://scan.sv-1.testnet.global.canton.network.sync.global/api/scan/v0/scans
```

**Что делать:**
1. Связаться с SV sponsor (GSF) для подтверждения статуса whitelisting
2. Уточнить, добавлен ли IP 65.108.15.20 в whitelist для Testnet
3. Если не добавлен - запросить добавление
4. Ожидать 2-7 дней для обновления allowlist у всех SV

---

### Mainnet (65.108.15.19)

**Статус маршрутизации**: ✅ Работает правильно  
**Статус whitelisting**: ✅ Работает (API доступен)

**Информация:**
- **IP адрес**: 65.108.15.19
- **Сеть**: Mainnet
- **Статус**: ✅ API доступен, Sequencer endpoints найдены
- **Готовность**: ✅ Готов к использованию

**Подтверждение:**
- ✅ Scan API доступен
- ✅ Sequencer API доступен
- ✅ Найдено 14 Sequencer endpoints
- ✅ IP правильно маршрутизируется

---

## 🔍 Как проверить whitelisting самостоятельно

### Метод 1: Через проверку валидации

```bash
# Testnet
kubectl apply -f blockchain/k8s/ip-validation-testnet.yaml
kubectl logs -l job-name=ip-validation-checker-testnet -f

# Mainnet
kubectl apply -f blockchain/k8s/ip-validation-mainnet.yaml
kubectl logs -l job-name=ip-validation-checker-mainnet -f
```

### Метод 2: Прямая проверка с сервера

```bash
# Подключитесь к серверу
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30

# Testnet
curl -v --interface 65.108.15.20 \
  https://scan.sv-1.testnet.global.canton.network.sync.global/api/scan/v0/scans

# Mainnet
curl -v --interface 65.108.15.19 \
  https://scan.sv-1.global.canton.network.sync.global/api/scan/v0/scans
```

### Метод 3: Проверка через скрипт

```bash
# Запустить скрипт проверки маршрутизации
bash blockchain/scripts/test-ip-routing.sh
```

---

## 📞 Контакты для проверки whitelisting

### SV Sponsor: GSF (Global Synchronizer Foundation)

**Для Testnet (65.108.15.20):**
- Уточнить статус whitelisting
- Запросить добавление IP в whitelist (если не добавлен)
- Проверить сроки обновления allowlist

**Для Mainnet (65.108.15.19):**
- ✅ IP уже в whitelist (подтверждено доступностью API)
- Дополнительная проверка не требуется

---

## 📊 Интерпретация результатов

### ✅ Успешная валидация

**Признаки:**
- API отвечает успешно (получен JSON)
- Найдены Sequencer endpoints
- Нет ошибок timeout

**Пример:**
```
✅ Успешное подключение к Scan API
✅ Успешное подключение к Sequencer API
Найдены Sequencer endpoints: 14
```

### ⏳ Частичная валидация / Timeout

**Признаки:**
- API timeout
- Нет ответа от Scan API
- Нет Sequencer endpoints

**Возможные причины:**
1. IP не в whitelist у всех Super Validators
2. IP не в whitelist у конкретного SV (scan.sv-1.testnet.global.canton.network.sync.global)
3. Сетевая проблема (маловероятно, если маршрутизация работает)

**Что делать:**
1. Проверить статус у SV sponsor
2. Подождать 2-7 дней для обновления allowlist
3. Повторить проверку позже

---

## 🎯 Текущий статус (последняя проверка)

**Дата проверки**: $(date +"%Y-%m-%d %H:%M:%S")

| Сеть | IP | Маршрутизация | API доступность | Whitelisting | Статус |
|------|-----|---------------|-----------------|--------------|--------|
| **Testnet** | 65.108.15.20 | ✅ Работает | ⏳ Timeout | ⏳ Требуется проверка | ⏳ Ожидание |
| **Mainnet** | 65.108.15.19 | ✅ Работает | ✅ Доступен | ✅ В whitelist | ✅ Готов |

---

## 📝 Рекомендации

### Для Testnet (65.108.15.20):

1. **Связаться с SV sponsor** для подтверждения статуса whitelisting
2. **Повторить проверку** через 2-7 дней
3. **Мониторить логи** проверки валидации

### Для Mainnet (65.108.15.19):

1. ✅ **IP валидирован** - можно использовать для развертывания валидатора
2. ✅ **API доступен** - все работает правильно
3. ✅ **Готов к production** - можно развертывать Mainnet валидатор

---

**Последнее обновление**: $(date +"%Y-%m-%d %H:%M:%S")





