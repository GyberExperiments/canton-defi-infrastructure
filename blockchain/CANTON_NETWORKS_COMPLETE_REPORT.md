# Общий отчет по всем сетям Canton Network

**Дата отчета**: 2025-11-29  
**Проект**: Canton Validator Node  
**Версия Canton**: 0.5.3  
**Сервер**: 65.108.15.30 (canton-node-65-108-15-30)

---

## 📊 Сводная таблица по всем сетям

| Параметр | DevNet | TestNet | MainNet |
|----------|--------|---------|---------|
| **IP адрес** | 65.108.15.30 | 65.108.15.20 | 65.108.15.19 |
| **Статус IP** | ✅ Настроен | ✅ Настроен | ✅ Настроен |
| **Валидация IP** | ✅ Валидирован | ⏳ Частично | ✅ Валидирован |
| **Sequencer endpoints** | ✅ Доступны | ❌ Timeout | ✅ 15 endpoints |
| **Scan API** | ✅ Доступен | ❌ Timeout | ✅ Доступен |
| **Onboarding Secret** | ✅ Через API | ⚠️ API или SV | ❌ Только SV |
| **Срок действия Secret** | 1 час | 48 часов | 48 часов |
| **API Endpoint** | ✅ Работает | ⏳ Проверка | ❌ Не существует |
| **Статус развертывания** | ✅ Развернут | ⏳ Ожидание | ⏳ Ожидание |
| **Готовность** | ✅ Готов | ⏳ Whitelisting | ✅ Готов |

---

## 🌐 Детальная информация по сетям

### 1. DevNet (Development Network)

#### 📍 Базовая информация
- **IP адрес**: 65.108.15.30/32
- **API URL**: `https://sv.sv-1.dev.global.canton.network.sync.global`
- **Scan API**: `https://scan.sv-1.dev.global.canton.network.sync.global`
- **Kubernetes нода**: `canton-node-65-108-15-30` ✅ Подключена

#### ✅ Статус валидации
- ✅ IP адрес правильно настроен и маршрутизируется
- ✅ IP адрес найден на интерфейсе сервера
- ✅ Scan API доступен
- ✅ Sequencer API доступен
- ✅ Валидация пройдена (14/15 SV)

#### 🔐 Получение Onboarding Secret
**Способ**: ✅ Публичный API

```bash
# Получить secret через API
curl -X POST https://sv.sv-1.dev.global.canton.network.sync.global/api/sv/v0/devnet/onboard/validator/prepare

# Или через скрипт
./scripts/get-onboarding-secret.sh devnet --save
```

**Характеристики**:
- ✅ Автоматическое получение через API
- ⏱️ Срок действия: **1 час**
- 🔄 Требуется регулярное обновление
- 📝 Формат ответа: JSON с полем `onboarding_secret`

#### 📊 Текущий статус
- ✅ **Развернут и работает**
- ✅ Валидатор подключен к DevNet
- ✅ Все сервисы функционируют
- ✅ Web UI доступен

#### 🎯 Следующие шаги
- ✅ Продолжать работу на DevNet
- ✅ Тестировать обновления перед Mainnet
- ✅ Мониторить срок действия secret (обновлять каждый час)

---

### 2. TestNet (Testing Network)

#### 📍 Базовая информация
- **IP адрес**: 65.108.15.20/24
- **API URL**: `https://sv.sv-1.test.global.canton.network.sync.global`
- **Scan API**: `https://scan.sv-1.test.global.canton.network.sync.global`
- **Kubernetes нода**: ⏳ Не подключена (IP на том же сервере)

#### ⏳ Статус валидации
- ✅ IP адрес правильно настроен и маршрутизируется
- ✅ IP адрес найден на интерфейсе сервера
- ✅ Запросы идут с правильного IP (подтверждено тестами)
- ❌ Scan API: **Timeout** (Connection timed out)
- ❌ Sequencer API: **Timeout** (Connection timed out)

**Интерпретация**:
- ✅ IP адрес настроен корректно
- ❌ IP **не в whitelist** у Super Validators
- ⏳ Требуется добавление в allowlist (2-7 дней)
- ⏳ Требуется проверка статуса у SV sponsor (GSF)

#### 🔐 Получение Onboarding Secret
**Способ**: ⚠️ API или от SV sponsor

```bash
# Попытка через API (может не работать)
curl -X POST https://sv.sv-1.test.global.canton.network.sync.global/api/sv/v0/testnet/onboard/validator/prepare

# Или через скрипт
./scripts/get-onboarding-secret.sh testnet --save
```

**Характеристики**:
- ⚠️ Может быть доступен через API (после whitelisting)
- 🔐 Или от SV sponsor вручную
- ⏱️ Срок действия: **48 часов**
- 📝 Одноразовое использование

#### 📊 Текущий статус
- ⏳ **Частично валидирован**
- ⏳ Ожидается whitelisting IP адреса
- ⏳ Ожидается получение onboarding secret
- ❌ Валидатор еще не развернут

#### 🎯 Следующие шаги
1. ⏳ **Связаться с SV sponsor (GSF)** для подтверждения whitelisting
2. ⏳ **Подождать 2-7 дней** для обновления allowlist у всех SV
3. ⏳ **Повторить проверку** после обновления whitelist
4. ⏳ **Получить onboarding secret** (через API или от SV sponsor)
5. ⏳ **Развернуть валидатор** на TestNet

#### 🔍 Команды для проверки
```bash
# Проверка валидации Testnet IP
kubectl delete job ip-validation-checker-testnet -n default --ignore-not-found=true
kubectl apply -f blockchain/k8s/ip-validation-testnet.yaml
kubectl logs -l job-name=ip-validation-checker-testnet -f
```

---

### 3. MainNet (Production Network)

#### 📍 Базовая информация
- **IP адрес**: 65.108.15.19/24
- **API URL**: `https://sv.sv-1.global.canton.network.sync.global`
- **Scan API**: `https://scan.sv-1.global.canton.network.sync.global`
- **Kubernetes нода**: ⏳ Не подключена (IP на том же сервере)

#### ✅ Статус валидации
- ✅ IP адрес правильно настроен и маршрутизируется
- ✅ IP адрес найден на интерфейсе сервера
- ✅ Маршрутизация работает (подтверждено тестами)
- ✅ Scan API: **Успешно получен ответ**
- ✅ Sequencer API: **Доступен**
- ✅ Найдено **15 Sequencer endpoints** (превышает минимум 14!)

**Найденные Sequencer endpoints**:
1. sequencer-3.sv-1.global.canton.network.fivenorth.io
2. sequencer-3.sv-1.global.canton.network.sync.global
3. sequencer-3.sv-1.global.canton.network.proofgroup.xyz
4. sequencer-2.sv-1.global.canton.network.tradeweb.com
5. sequencer-3.sv-1.global.canton.network.tradeweb.com
6. sequencer-3.sv-1.global.canton.network.digitalasset.com
7. sequencer-3.sv-2.global.canton.network.cumberland.io
8. sequencer-3.sv-1.global.canton.network.lcv.mpch.io
9. sequencer-3.sv-2.global.canton.network.digitalasset.com
10. sequencer-3.sv-1.global.canton.network.cumberland.io
11. sequencer-3.sv.global.canton.network.sv-nodeops.com
12. sequencer-3.sv-1.global.canton.network.c7.digital
13. sequencer-3.sv-1.global.canton.network.mpch.io
14. sequencer-3.sv-1.global.canton.network.orb1lp.mpch.io
15. (еще один endpoint)

**Вывод**: ✅ IP адрес **полностью валидирован** и готов к использованию на Mainnet.

#### 🔐 Получение Onboarding Secret
**Способ**: ❌ **ТОЛЬКО от SV sponsor** (НЕТ публичного API)

**Попытки через API**:
```bash
# ❌ Все эти endpoints возвращают 404 Not Found:
curl -X POST https://sv.sv-1.main.global.canton.network.sync.global/api/sv/v0/mainnet/onboard/validator/prepare
# → 404 page not found

curl -X POST https://sv.sv-1.global.canton.network.sync.global/api/sv/v0/mainnet/onboard/validator/prepare
# → The requested resource could not be found
```

**Характеристики**:
- ❌ **НЕТ публичного API** для Mainnet
- 🔐 **Только от SV sponsor** вручную
- ⏱️ Срок действия: **48 часов**
- 📝 Одноразовое использование
- ✅ Требуется одобрение Tokenomics Committee

**Процесс получения**:
1. ✅ IP адрес валидирован (выполнено)
2. ⏳ Связаться с SV sponsor
3. ⏳ Запросить Mainnet onboarding secret
4. ⏳ Получить secret от SV sponsor
5. ⏳ Сохранить в `blockchain/config/onboarding-secrets.env`

**Шаблон запроса**: `blockchain/MAINNET_SECRET_REQUEST_TEMPLATE.md`

#### 📊 Текущий статус
- ✅ **Полностью валидирован**
- ✅ IP адрес готов к использованию
- ⏳ Ожидается получение onboarding secret от SV sponsor
- ❌ Валидатор еще не развернут

#### 🎯 Следующие шаги
1. ✅ IP валидирован - готов к использованию
2. ⏳ **Связаться с SV sponsor** для получения Mainnet secret
3. ⏳ **Использовать шаблон запроса** из `MAINNET_SECRET_REQUEST_TEMPLATE.md`
4. ⏳ **Получить onboarding secret** от SV sponsor
5. ⏳ **Сохранить secret** в `blockchain/config/onboarding-secrets.env`
6. ⏳ **Развернуть Mainnet валидатор**

#### 🔍 Команды для проверки
```bash
# Проверка валидации Mainnet IP
kubectl delete job ip-validation-checker-mainnet -n default --ignore-not-found=true
kubectl apply -f blockchain/k8s/ip-validation-mainnet.yaml
kubectl logs -l job-name=ip-validation-checker-mainnet -f
```

---

## 🔄 Сравнительная таблица получения Onboarding Secret

| Сеть | Способ получения | API Endpoint | Срок действия | Требования |
|------|------------------|-------------|---------------|------------|
| **DevNet** | ✅ Публичный API | `POST SPONSOR_SV_URL/api/sv/v0/devnet/onboard/validator/prepare` | 1 час | IP в allowlist |
| **TestNet** | ⚠️ API или SV sponsor | `POST SPONSOR_SV_URL/api/sv/v0/testnet/onboard/validator/prepare` | 48 часов | IP в allowlist, одобрение |
| **MainNet** | ❌ Только SV sponsor | **НЕТ публичного API** | 48 часов | IP в allowlist, одобрение Tokenomics Committee |

---

## 📋 Общие рекомендации

### Для DevNet
- ✅ Продолжать работу и тестирование
- ✅ Регулярно обновлять onboarding secret (каждый час)
- ✅ Использовать для разработки и тестирования новых функций

### Для TestNet
- ⏳ Дождаться whitelisting IP адреса (2-7 дней)
- ⏳ Связаться с SV sponsor для подтверждения статуса
- ⏳ После whitelisting получить onboarding secret
- ⏳ Развернуть валидатор для тестирования перед Mainnet

### Для MainNet
- ✅ IP адрес полностью готов
- ⏳ Связаться с SV sponsor для получения onboarding secret
- ⏳ Использовать шаблон запроса из документации
- ⏳ После получения secret развернуть валидатор

---

## 🔗 Полезные ссылки

### Официальная документация
- **Validator Onboarding**: https://docs.dev.sync.global/validator_operator/validator_onboarding.html
- **Docker Compose Deployment**: https://docs.dev.sync.global/validator_operator/validator_compose.html
- **Kubernetes Deployment**: https://docs.dev.sync.global/validator_operator/validator_helm.html

### Контакты
- **Canton Foundation Operations**: operations@sync.global
- **Validator Request Form**: https://canton.foundation/validator-request/
- **List of Super Validators**: https://canton.foundation/validators/

### Slack и Mailing Lists
- **Slack**: #validator-operations (через Slack Connect)
- **Mailing Lists**: https://lists.sync.global/
  - main: Общая информация о Canton Network
  - cip-announce: Новые CIPs
  - tokenomics-announce: Одобрения новых валидаторов
  - validator-announce: Объявления для валидаторов

---

## 📁 Связанные файлы проекта

### Отчеты
- `TESTNET_MAINNET_VALIDATION_REPORT.md` - Детальный отчет о валидации
- `MAINNET_SECRET_OBTAINING_REPORT.md` - Отчет о получении Mainnet secret
- `MAINNET_SECRET_DOCUMENTATION_RESEARCH.md` - Исследование документации
- `MAINNET_SECRET_SSH_ATTEMPT_REPORT.md` - Попытка получения через SSH

### Шаблоны и инструкции
- `MAINNET_SECRET_REQUEST_TEMPLATE.md` - Шаблон запроса для SV sponsor
- `PROMPT_GET_MAINNET_SECRET.md` - Промпт с результатами
- `config/onboarding-secrets.env.template` - Шаблон для сохранения secrets

### Скрипты
- `scripts/get-onboarding-secret.sh` - Получение secrets для всех сетей
- `scripts/validate-testnet-ip.sh` - Проверка Testnet IP
- `scripts/validate-mainnet-ip.sh` - Проверка Mainnet IP

### Kubernetes манифесты
- `k8s/ip-validation-testnet.yaml` - Job для проверки Testnet
- `k8s/ip-validation-mainnet.yaml` - Job для проверки Mainnet
- `k8s/get-mainnet-secret-job.yaml` - Job для получения Mainnet secret

---

## ✅ Чеклист готовности

### DevNet
- [x] IP адрес настроен (65.108.15.30)
- [x] IP валидирован
- [x] Onboarding secret получен
- [x] Валидатор развернут
- [x] Все сервисы работают

### TestNet
- [x] IP адрес настроен (65.108.15.20)
- [x] IP маршрутизация работает
- [ ] IP в whitelist у SV (ожидание 2-7 дней)
- [ ] Onboarding secret получен
- [ ] Валидатор развернут

### MainNet
- [x] IP адрес настроен (65.108.15.19)
- [x] IP полностью валидирован (15 Sequencer endpoints)
- [x] IP в whitelist у SV
- [ ] Onboarding secret получен от SV sponsor
- [ ] Валидатор развернут

---

## 🎯 Приоритетные задачи

### Высокий приоритет
1. ⏳ **Получить Mainnet onboarding secret** от SV sponsor
2. ⏳ **Развернуть Mainnet валидатор** после получения secret

### Средний приоритет
3. ⏳ **Проверить whitelisting для Testnet** у SV sponsor
4. ⏳ **Получить Testnet onboarding secret** после whitelisting
5. ⏳ **Развернуть Testnet валидатор** для тестирования

### Низкий приоритет
6. ✅ Продолжать работу на DevNet
7. ✅ Мониторить и обновлять DevNet secret

---

**Последнее обновление**: 2025-11-29  
**Следующая проверка**: После получения Mainnet secret от SV sponsor





