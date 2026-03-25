# 🎯 MASTER PROMPT: Canton Participant Domain Connection - Complete Resolution

## 🔴 КРИТИЧЕСКАЯ ПРОБЛЕМА

Canton Participant развёрнут в Kubernetes (namespace: `validator`, pod: `participant-5c8bc8496b-hnspj`), но **не подключён к synchronizer (domain)**, что делает невозможным:
- Создание parties (`PARTY_ALLOCATION_WITHOUT_CONNECTED_SYNCHRONIZER`)
- Создание DAML контрактов
- Выполнение транзакций через Ledger API

## 📊 ТЕКУЩЕЕ СОСТОЯНИЕ СИСТЕМЫ

### ✅ Работает корректно:
1. **Canton Participant** - запущен, здоров, доступен через gRPC
   - Endpoint: `participant.validator.svc.cluster.local:5001` (Ledger API)
   - Admin API: `participant.validator.svc.cluster.local:5002`
   - JWT аутентификация настроена (HMAC-256, secret: "unsafe")
   - Пользователь создан: `canton-otc-platform`
   - База данных PostgreSQL работает

2. **Rust Canton OTC API Server** - развёрнут и готов
   - Deployment: `canton-api-server` (namespace: `canton-otc`)
   - Подключается к participant, готов создавать контракты
   - JWT token настроен в K8s secret `canton-auth`

3. **Инфраструктура**
   - Static egress IP: **65.108.15.30** (whitelisted для DevNet)
   - Node selector работает: `kubernetes.io/hostname=canton-node-65-108-15-30`

### ❌ Критическая проблема:
**Participant не подключён ни к одному synchronizer (domain)**

Проверка:
```bash
kubectl -n canton-otc run grpcurl-test --image=fullstorydev/grpcurl --rm -i --restart=Never -- \
  -plaintext -d '{}' \
  participant.validator.svc.cluster.local:5002 \
  com.digitalasset.canton.admin.participant.v30.SynchronizerConnectivityService.ListConnectedSynchronizers
# Результат: {} (пусто)
```

## 🎯 ЗАДАЧА

**Настроить подключение Canton Participant к synchronizer (domain) для полноценной работы с DAML контрактами.**

Необходимо провести глубокое исследование и реализовать одно из решений:

### Вариант A: Подключение к Canton Network DevNet Global Domain
- Получить onboarding secret для DevNet
- Зарегистрировать synchronizer через SynchronizerConnectivityService
- Подключить participant к global domain

### Вариант B: Развернуть локальный Canton Domain для тестирования
- Создать минимальный Canton domain в том же K8s кластере
- Настроить participant для подключения к локальному domain
- Протестировать создание контрактов

## 📚 ИССЛЕДОВАТЕЛЬСКАЯ РАБОТА REQUIRED

### 1. **Canton Network Architecture Deep Dive**
Изучи:
- Официальная документация Canton Network: https://docs.canton.network/
- Splice documentation: https://docs.dev.global.canton.network.sync.global/
- Canton protocol documentation: https://docs.daml.com/canton/
- GitHub: https://github.com/digital-asset/decentralized-canton-sync

Вопросы для исследования:
- Как participant подключается к synchronizer в Canton Network?
- Какие параметры нужны для RegisterSynchronizer?
- Какой формат synchronizer connection config?
- Требуется ли onboarding для локального domain?

### 2. **Canton gRPC API Research**
Изучи proto файлы и документацию:
- `SynchronizerConnectivityService` - все методы
- `RegisterSynchronizer` - точные параметры запроса
- `ConnectSynchronizer` vs `RegisterSynchronizer` - разница
- Примеры использования в Canton Network deployments

Найди:
- Формат запроса RegisterSynchronizer
- Обязательные поля: synchronizer_alias, connection config
- Примеры connection strings для sequencer

### 3. **DevNet Onboarding Process**
Проверь:
- Актуальный endpoint для получения DevNet onboarding secret
- Требования к IP whitelisting
- Альтернативные способы получения secret
- Возможность использования без onboarding для тестирования

URL для проверки:
- `https://sv.sv-1.dev.global.canton.network.sync.global/api/sv/v0/devnet/onboard/validator/prepare`
- Документация: https://docs.dev.global.canton.network.sync.global/validator_operator/

### 4. **Local Canton Domain Deployment**
Исследуй минимальную конфигурацию:
- Canton open-source domain setup
- Минимальные требования (storage: memory достаточно?)
- Конфигурация для работы с participant
- Protocol version compatibility (participant использует v34)

Docker images для проверки:
- `digitalasset/canton-open-source:2.9.3`
- `ghcr.io/digital-asset/decentralized-canton-sync/docker/canton-domain`

### 5. **Existing Configuration Analysis**
Проанализируй имеющиеся конфиги в проекте:
- `/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/blockchain/config/`
- Скрипты в `/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/blockchain/scripts/`
- K8s манифесты в `/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/blockchain/k8s/`
- Docker compose примеры

Найди примеры:
- Как регистрируется synchronizer в существующих setup'ах
- Какие environment variables используются
- Есть ли bootstrap скрипты для domain connection

## 🔧 ТЕХНИЧЕСКИЕ ДЕТАЛИ ДЛЯ ИССЛЕДОВАНИЯ

### Canton Participant Info:
```yaml
Pod: participant-5c8bc8496b-hnspj
Namespace: validator
Image: ghcr.io/digital-asset/decentralized-canton-sync/docker/canton-participant:0.5.7
Admin API: participant.validator.svc.cluster.local:5002
Ledger API: participant.validator.svc.cluster.local:5001
Protocol Version: 34
```

### Available gRPC Services (Admin API :5002):
- `com.digitalasset.canton.admin.participant.v30.SynchronizerConnectivityService`
- `com.digitalasset.canton.topology.admin.v30.TopologyManagerWriteService`
- `com.digitalasset.canton.admin.participant.v30.PartyManagementService`
- И другие (см. полный список через grpcurl list)

### Ключевые вопросы для решения:

1. **Synchronizer Registration**:
   ```
   Q: Какой точный формат запроса для RegisterSynchronizer?
   Q: Нужен ли sequencer connection URL или достаточно alias?
   Q: Требуется ли TLS/auth для подключения к domain?
   ```

2. **DevNet Integration**:
   ```
   Q: Работает ли текущий endpoint для onboarding?
   Q: Можно ли обойти onboarding для testing?
   Q: Есть ли публичный DevNet sequencer для прямого подключения?
   ```

3. **Local Domain**:
   ```
   Q: Минимальная конфигурация Canton domain для K8s?
   Q: Нужна ли PostgreSQL для domain или достаточно memory storage?
   Q: Как participant находит local domain (discovery mechanism)?
   ```

## ✅ КРИТЕРИИ УСПЕХА

После выполнения должно работать:

1. **Synchronizer Connected**:
   ```bash
   ListConnectedSynchronizers → возвращает хотя бы один domain
   ```

2. **Party Creation Works**:
   ```bash
   AllocateParty с party_id_hint="otc_operator" → успех
   ```

3. **Contract Creation Works**:
   ```bash
   POST /api/v1/contracts/offer → возвращает реальный contract_id и transaction_id
   ```

4. **Production Ready**:
   - Rust Canton OTC API создаёт настоящие DAML контракты
   - Frontend на https://1otc.cc показывает зелёный статус Canton
   - Контракты сохраняются на ledger (не stub)

## 📋 ПЛАН ДЕЙСТВИЙ (для агента)

### Phase 1: Research & Analysis (30 минут)
1. Изучи Canton Network documentation для synchronizer connectivity
2. Найди примеры RegisterSynchronizer requests в документации/GitHub
3. Проверь актуальность DevNet onboarding endpoints
4. Исследуй local domain deployment options
5. Проанализируй существующие конфиги в проекте

### Phase 2: Decision & Design (15 минут)
1. Выбери оптимальный подход (DevNet vs Local Domain)
2. Спроектируй точный plan подключения
3. Подготовь все необходимые конфиги/манифесты
4. Определи команды для выполнения

### Phase 3: Implementation (30 минут)
1. Выполни подключение к synchronizer
2. Создай необходимые parties
3. Выдай права пользователю canton-otc-platform
4. Протестируй создание контракта

### Phase 4: Verification (15 минут)
1. Проверь ListConnectedSynchronizers
2. Протестируй AllocateParty
3. Создай тестовый DAML контракт через API
4. Проверь production endpoint

## 🚨 ВАЖНЫЕ CONSTRAINTS

1. **Не использовать stub/mock решения** - только реальная интеграция
2. **Минимизировать изменения participant конфига** - он уже deployed
3. **Использовать существующие K8s ресурсы** где возможно
4. **Egress IP 65.108.15.30** - использовать для DevNet запросов
5. **Protocol version 34** - compatibility required

## 📊 ДОСТУПНЫЕ ИНСТРУМЕНТЫ

В системе доступны:
- `kubectl` - для K8s операций
- `grpcurl` - для gRPC вызовов (есть в K8s pod)
- `curl` - для HTTP API
- Python 3 - для скриптов
- Полный доступ к файловой системе проекта
- Доступ к интернету для research

## 🎯 ФИНАЛЬНАЯ ЦЕЛЬ

**Canton OTC Platform с реальной DAML интеграцией работает на production (https://1otc.cc/), создавая настоящие Canton Network контракты через Rust API server.**

---

## 📝 EXECUTION NOTES

Агент должен:
1. ✅ Провести тщательное исследование ПЕРЕД началом имплементации
2. ✅ Документировать все найденные решения
3. ✅ Объяснить выбор подхода (DevNet vs Local)
4. ✅ Показать точные команды перед выполнением
5. ✅ Проверить каждый шаг
6. ✅ Создать финальный отчёт с результатами

**НЕ НАЧИНАЙ имплементацию пока не проведёшь полное исследование и не получишь чёткое понимание как работает synchronizer connectivity в Canton!**

---

## 🔗 ПОЛЕЗНЫЕ ССЫЛКИ

- Canton Network Docs: https://docs.canton.network/
- Splice Validator Guide: https://docs.dev.global.canton.network.sync.global/validator_operator/
- Canton Protocol: https://docs.daml.com/canton/
- DAML SDK: https://docs.daml.com/
- GitHub Canton: https://github.com/digital-asset/canton
- GitHub Splice: https://github.com/digital-asset/decentralized-canton-sync

---

**Статус**: Ready for execution
**Приоритет**: CRITICAL
**Estimated Time**: 90 минут (research + implementation + verification)
