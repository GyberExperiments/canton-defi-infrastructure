# Исследование документации: Получение Mainnet Onboarding Secret

**Дата исследования**: 2025-11-29  
**Источники**: Официальная документация Canton Network, Splice, web search

---

## 📚 Исследованные источники

1. **Официальная документация Canton Network**
   - https://docs.digitalasset.com/canton/
   - https://docs.dev.sync.global/validator_operator/validator_onboarding.html
   - https://docs.dev.global.canton.network.sync.global/

2. **Splice документация**
   - https://github.com/hyperledger-labs/splice
   - Validator Operator Guides

3. **Canton Foundation**
   - https://canton.foundation/validator-request/
   - https://canton.foundation/validators/

---

## 🔍 Ключевые находки

### 1. Различия между сетями

| Сеть | Способ получения Secret | Срок действия | API Endpoint |
|------|------------------------|---------------|--------------|
| **DevNet** | ✅ Публичный API | 1 час | `POST SPONSOR_SV_URL/api/sv/v0/devnet/onboard/validator/prepare` |
| **TestNet** | ⚠️ API или SV sponsor | 48 часов | `POST SPONSOR_SV_URL/api/sv/v0/testnet/onboard/validator/prepare` |
| **MainNet** | ❌ **Только от SV sponsor** | 48 часов | **НЕТ публичного API** |

### 2. Официальная документация подтверждает

**Из документации Splice**:
> "On DevNet, you can generate this yourself via an API call; on TestNet and MainNet, your sponsor provides it manually."

**Из документации validator onboarding**:
> "Unlike DevNet, where you can generate this secret yourself via an API call, for MainNet, your SV sponsor must provide it to you manually."

### 3. Процесс получения Mainnet Secret

Согласно официальной документации:

1. **Одобрение Tokenomics Committee** - требуется для Mainnet
2. **SV Sponsor** - должен предоставить secret вручную
3. **IP Allowlist** - IP должен быть добавлен в allowlist (2-7 дней)
4. **Запрос Secret** - запросить у SV sponsor после allowlisting
5. **Срок действия** - 48 часов, одноразовое использование

---

## 📋 API Endpoints (для справки)

### DevNet (работает)
```bash
curl -X POST https://sv.sv-1.dev.global.canton.network.sync.global/api/sv/v0/devnet/onboard/validator/prepare
```

### TestNet (может работать)
```bash
curl -X POST https://sv.sv-1.test.global.canton.network.sync.global/api/sv/v0/testnet/onboard/validator/prepare
```

### MainNet (НЕ РАБОТАЕТ - нет публичного API)
```bash
# Эти endpoints НЕ существуют для Mainnet:
# ❌ https://sv.sv-1.main.global.canton.network.sync.global/api/sv/v0/mainnet/onboard/validator/prepare
# ❌ https://sv.sv-1.global.canton.network.sync.global/api/sv/v0/mainnet/onboard/validator/prepare
```

**Результат проверки**: Все попытки получить Mainnet secret через API возвращают **404 Not Found**.

---

## ✅ Подтверждение из документации

### Из Splice документации:

**Required Network Parameters**:
> "Prepare DevNet Onboarding Secret using curl"
> ```shell
> curl -X POST SPONSOR_SV_URL/api/sv/v0/devnet/onboard/validator/prepare
> ```
> "This command demonstrates how to obtain an onboarding secret automatically for DevNet."

**Важно**: В документации **НЕТ** аналогичной команды для Mainnet!

### Из Validator Onboarding Process:

**MainNet Requirements**:
1. Approval by Tokenomics Committee
2. SV Sponsor must provide onboarding secret manually
3. IP must be allowlisted (2-7 days)
4. Secret valid for 48 hours, single-use

---

## 🔐 Процесс получения Mainnet Secret

### Шаг 1: Одобрение Tokenomics Committee

- Подать заявку: https://canton.foundation/validator-request/
- Ожидать одобрения (обычно 2 недели)
- Получить SV sponsor (если еще нет)

### Шаг 2: Предоставить IP адрес

- IP адрес: **65.108.15.19** ✅ (уже валидирован)
- Статус: ✅ Полностью валидирован (15 Sequencer endpoints)
- Предоставить SV sponsor для allowlisting

### Шаг 3: Ожидание Allowlisting

- Обычно занимает 2-7 дней
- Проверить можно через Scan API (уже проверено ✅)

### Шаг 4: Запрос Onboarding Secret

- **Связаться с SV sponsor**
- Запросить Mainnet onboarding secret
- Использовать шаблон из `MAINNET_SECRET_REQUEST_TEMPLATE.md`

### Шаг 5: Использование Secret

- Secret действителен **48 часов**
- **Одноразовое использование**
- Если истечет - запросить новый у SV sponsor

---

## 📝 Выводы исследования

### ✅ Подтверждено:

1. **Mainnet НЕ имеет публичного API** для получения onboarding secret
2. **Требуется получение от SV sponsor** вручную
3. **Процесс требует одобрения** Tokenomics Committee
4. **IP адрес 65.108.15.19 готов** - полностью валидирован
5. **Все попытки API возвращают 404** - это ожидаемо

### ❌ Опровергнуто:

1. ~~Mainnet имеет публичный API endpoint~~ - НЕТ
2. ~~Можно получить secret через curl~~ - НЕТ, только от SV sponsor
3. ~~API endpoint просто недоступен временно~~ - НЕТ, endpoint не существует

---

## 🎯 Рекомендации

### Немедленные действия:

1. ✅ **IP валидирован** - готов к использованию
2. ⏳ **Связаться с SV sponsor** - использовать шаблон запроса
3. ⏳ **Получить onboarding secret** - от SV sponsor
4. ⏳ **Сохранить secret** - в `blockchain/config/onboarding-secrets.env`

### Долгосрочные действия:

1. Если нет SV sponsor - подать заявку через Canton Foundation
2. Присоединиться к Slack каналу `#validator-operations`
3. Подписаться на mailing lists (tokenomics-announce, validator-announce)

---

## 📚 Ссылки на документацию

### Официальные ресурсы:

1. **Validator Onboarding Process**: https://docs.dev.sync.global/validator_operator/validator_onboarding.html
2. **Docker Compose Deployment**: https://docs.dev.sync.global/validator_operator/validator_compose.html
3. **Kubernetes Deployment**: https://docs.dev.sync.global/validator_operator/validator_helm.html
4. **Validator Request Form**: https://canton.foundation/validator-request/
5. **List of Super Validators**: https://canton.foundation/validators/

### Контакты:

- **Canton Foundation Operations**: operations@sync.global
- **Slack**: #validator-operations (через Slack Connect)
- **Mailing Lists**: https://lists.sync.global/

---

## 🔗 Связанные файлы проекта

- `MAINNET_SECRET_OBTAINING_REPORT.md` - Полный отчет о процессе
- `MAINNET_SECRET_REQUEST_TEMPLATE.md` - Шаблон запроса для SV sponsor
- `MAINNET_SECRET_SSH_ATTEMPT_REPORT.md` - Отчет о попытке через SSH
- `PROMPT_GET_MAINNET_SECRET.md` - Промпт с результатами

---

**Вывод**: Документация **однозначно подтверждает**, что для Mainnet **НЕТ публичного API** для получения onboarding secret. Secret **должен быть получен от SV sponsor вручную** после одобрения Tokenomics Committee и allowlisting IP адреса.

---

**Последнее обновление**: 2025-11-29





