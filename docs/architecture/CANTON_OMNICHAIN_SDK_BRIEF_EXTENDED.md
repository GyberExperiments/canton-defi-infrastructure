# Canton OmniChain SDK -- Краткий бриф (расширенный)

**By Gybernaty Community**
**Версия документа:** 1.1 | **Дата:** 4 февраля 2026
**Статус:** DevNet Ready

---

## 1. Обзор

**Canton OmniChain SDK** -- профессиональный Rust SDK для интеграции с Canton Network и построения кроссчейн-решений (Canton <-> EVM/Cosmos/Substrate).

### Назначение

- **Институциональные DeFi приложения** -- казначейские облигации, токенизация недвижимости и ценных бумаг, приватные хранилища
- **Кроссчейн интеграции** -- мосты между Canton Network и EVM/Cosmos/Substrate
- **Enterprise-grade решения** -- compliance, KYC/AML, регуляторные требования

### Наша инфраструктура DevNet

| Параметр | Значение |
|----------|----------|
| Хост | `65.108.15.30` |
| HTTP Ledger API | `http://65.108.15.30:30757` |
| gRPC Ledger API | `65.108.15.30:30501` |
| Participant ID | `participant1` |
| Party ID | `wealth_management_party` |
| Auth | Supabase Auth (JWKS) |
| Версия Canton | 0.5.8 |
| Sponsor SV | `https://sv.sv-1.dev.global.canton.network.sync.global` |

---

## 2. Ключевые особенности

| Крейт | Назначение | DevNet статус |
|-------|------------|---------------|
| canton-core | Типы, ошибки, трейты | Готов |
| canton-ledger-api | gRPC Ledger API v2 | Подключен |
| canton-crypto | KeyStore, Ed25519/P-256/secp256k1 | Готов |
| canton-wallet | Wallet, деривация, PartyId | В разработке |
| canton-transport | tonic gRPC, TLS | Готов |
| canton-reliability | Retry, circuit breaker | В разработке |
| canton-observability | OpenTelemetry | В разработке |

---

## 3. Архитектура SDK

```
+-------------------------------------------------------------+
|                   Your Application                          |
+---------------------------+---------------------------------+
                            |
+---------------------------v---------------------------------+
|                 Canton OmniChain SDK                        |
|  +--------------+  +--------------+  +--------------+       |
|  | canton-core |  | canton-wallet|  |canton-crypto |        |
|  +--------------+  +--------------+  +--------------+       |
|  +--------------+  +--------------+  +--------------+       |
|  |ledger-api    |  | transport    |  |observability |       |
|  +--------------+  +--------------+  +--------------+       |
+---------------------------+---------------------------------+
                            | gRPC/Tonic
+---------------------------v---------------------------------+
|              Canton Network (Participant)                   |
|           Ledger API v2 + State Management                  |
+---------------------------+---------------------------------+
                            |
+---------------------------v---------------------------------+
|               Global Synchronizer                           |
|      Super Validators | Sequencers | Mediators              |
+-------------------------------------------------------------+
```

### Слои SDK

1. **Core Layer** -- базовые типы, конфигурация, ошибки
2. **Transport Layer** -- gRPC (tonic), TLS, keep-alive
3. **Service Layer** -- Ledger API сервисы, стримы
4. **Domain Layer** -- Treasury, RealEstate, Privacy, Oracle
5. **Wallet Layer** -- ключи, подписи, деривация

---

## 4. Кроссчейн функциональность

| Компонент | Описание |
|-----------|----------|
| OmniChain мосты | Canton <-> EVM, Cosmos, Substrate |
| Гибкая деривация | Unified и PerChain стратегии |
| Multi-Identity Wallet | Единый кошелек для множества сетей |
| Asset bridging | Токенизация и перевод активов между цепочками |

---

## 5. Технологический стек

### SDK (Rust)

| Компонент | Технология | Версия |
|-----------|-----------|--------|
| Язык | Rust | 1.93+ (stable) |
| gRPC | tonic | 0.14+ |
| HTTP/2 | hyper | 1.x |
| Async runtime | tokio | 1.x |
| Middleware | tower | 0.5+ |
| Сериализация | serde | 1.x |
| Конфигурация | config-rs | 0.14+ |
| Ошибки | thiserror | 1.x |
| Observability | opentelemetry | 0.28+ |
| Крипто | ed25519-dalek, k256 | latest |

### Canton Network

| Компонент | Версия |
|-----------|--------|
| Canton (целевой стек) | 3.4 |
| Splice | Global Synchronizer |
| Protocol | Canton Protocol 4 |
| DevNet нода (текущая) | 0.5.8 |

---

## 6. Преимущества

### Для разработчиков

| Преимущество | Описание |
|--------------|----------|
| Type-safe API | Полная типизация Rust, compile-time проверки |
| Async-first | Tokio runtime, неблокирующие операции |
| Zero-cost abstractions | Производительность на уровне C/C++ |
| Ergonomic API | Builder pattern, fluent interfaces |
| Comprehensive docs | Документация с примерами |

### Для бизнеса

| Преимущество | Описание |
|--------------|----------|
| Institutional-grade | Соответствие финансовым регуляторам |
| Privacy by design | Встроенная приватность Canton |
| Compliance ready | KYC/AML, Travel Rule, MiCA |
| 24/7 settlement | Атомарные расчеты в реальном времени |
| Multi-jurisdiction | Поддержка различных юрисдикций |

---

## 7. Подключение к Ledger API

### gRPC эндпоинт

```rust
// canton-ledger-api/src/client.rs
use tonic::transport::Channel;

pub async fn connect_ledger() -> Result<LedgerClient, LedgerError> {
    let endpoint = "http://65.108.15.30:30501";
    let channel = Channel::from_endpoint(endpoint).connect().await?;
    
    let client = LedgerApiClient::new(channel);
    let ledger_id = client
        .get_ledger_id(())
        .await?
        .into_inner()
        .ledger_id;
    
    Ok(LedgerClient::new(client, ledger_id))
}
```

### HTTP JSON API

```bash
# Health check
curl http://65.108.15.30:30757/health

# Ledger info
curl http://65.108.15.30:30757/api/v1/ledger/identity

# Parties
curl http://65.108.15.30:30757/api/v1/parties
```

---

## 8. Аутентификация (DevNet)

### Без TLS (DevNet)

```yaml
# config/devnet.yaml
ledger_api:
  grpc_host: "65.108.15.30"
  grpc_port: 30501
  http_url: "http://65.108.15.30:30757"
  tls: false
  auth:
    enabled: false
    jwks_url: "http://65.108.15.30:8000/auth/v1/jwks"
```

### С TLS (TestNet/MainNet)

```yaml
ledger_api:
  tls: true
  auth:
    enabled: true
    jwks_url: "https://api.1otc.cc/auth/v1/jwks"
    audience: "authenticated"
```

---

## 9. Ledger API v2 сервисы

### Command Submission

```rust
// Отправка команды
let command = Command::create_and_exercise_command {
    template_id: "TreasuryBillToken:Gybernaty::0.0.1",
    payload: serde_json::json!({
        "issuer": "Gybernaty",
        "faceValue": 10000_00,
        "currency": "USD",
        "maturityDate": "2026-06-30"
    }),
    choice: "Create",
    choice_argument: serde_json::json!({})
};

let request = SubmitCommandRequest {
    command_id: Uuid::new_v4().to_string(),
    ledger_id: ledger_id.clone(),
    application_id: "canton-otc".to_string(),
    party: "wealth_management_party".to_string(),
    commands: vec![command],
};

let response = client.submit_command(request).await?;
```

### Transaction Stream

```rust
// Стрим транзакций с offset
let mut stream = client.transactions(
    GetTransactionsRequest {
        ledger_id: ledger_id.clone(),
        begin_offset: Some(Offset { value: Some(Box::new(current_offset)) }),
        end_offset: None,
        filter: TransactionFilter::all(),
        verbose: true,
    }
).await?;

while let Some(tx) = stream.message().await? {
    process_transaction(tx);
}
```

### Active Contracts (ACS)

```rust
// Получение активных контрактов
let mut acs = client.active_contracts(
    GetActiveContractsRequest {
        ledger_id: ledger_id.clone(),
        filter: TransactionFilter {
            template_ids: vec!["TreasuryBillToken:Gybernaty::0.0.1".to_string()],
        },
        verbose: true,
    }
).await?;

while let Some(contract) = acs.message().await? {
    store_contract(contract);
}
```

### Party Management

```rust
// Регистрация party
let party = client.allocate_party(
    AllocatePartyRequest {
        party_id_hint: Some("wealth_management_party".to_string()),
        display_name: "Wealth Management Party".to_string(),
    }
).await?;
```

---

## 10. Жизненный цикл команды

```
+-------------------------------------------------------------+
|  1. CREATE      ->  generate command_id, deduplication key   |
|  2. SUBMIT      ->  gRPC SubmitCommand                       |
|  3. COMPLETION  ->  async stream, command status             |
|  4. TRANSACTION ->  persisted, visible to stakeholders       |
|  5. EVENT       ->  emit for observers                      |
+-------------------------------------------------------------+
```

### Дедупликация

```rust
// idempotent retry с change_id
let command_id = format!("{}_{}", party_id, Utc::now().timestamp_nanos());

let completion = client
    .submit_and_wait(command_id, commands)
    .with_retry(RetryConfig {
        max_retries: 3,
        delay_ms: 1000,
        backoff: 2.0,
    })
    .await?;
```

---

## 11. DeFi модули

### Treasury Bills

```daml
-- DAML шаблон (docs/PRD_CANTON_DEFI_2026/05_DAML_CONTRACTS_SPEC.md)
template TreasuryBillToken
  with
    issuer : Party
    faceValue : Decimal
    currency : Text
    maturityDate : Date
    owners : [Party]
  where
    signatory issuer, owners
```

### Real Estate

```daml
template RealEstateToken
  with
    propertyId : Text
    totalShares : Int
    owners : [Party]
    valuation : Decimal
    governance : Party
```

### Privacy Vaults

```daml
template PrivacyVault
  with
    owner : Party
    assetId : Text
    zkProof : ZKProof
    timelock : Optional Date
```

---

## 12. Конфигурация SDK

### Переменные окружения

```bash
# Ledger API
export CANTON_LEDGER_GRPC=65.108.15.30:30501
export CANTON_LEDGER_HTTP=http://65.108.15.30:30757
export CANTON_PARTICIPANT_ID=participant1
export CANTON_PARTY_ID=wealth_management_party

# Auth (Supabase)
export CANTON_AUTH_TOKEN=
export CANTON_AUTH_JWKS_URL=http://65.108.15.30:8000/auth/v1/jwks

# Reliability
export CANTON_RETRY_MAX=3
export CANTON_RETRY_DELAY_MS=1000
export CANTON_CIRCUIT_BREAKER_THRESHOLD=5
```

---

## 13. Observability

### OpenTelemetry интеграция

```rust
// canton-observability/src/tracer.rs
use opentelemetry::{global, trace::Tracer};

pub fn init_tracer() -> Tracer {
    let tracer = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_endpoint("http://65.108.15.30:4317")
        .with_tls(false)  // DevNet
        .install_simple()
        .expect("Failed to create tracer");
    
    global::set_tracer(tracer.clone());
    tracer
}
```

### Метрики

| Метрика | Описание |
|---------|----------|
| canton.commands.submitted | Команды отправлены |
| canton.commands.completed | Команды завершены |
| canton.commands.failed | Команды с ошибками |
| canton.transactions.total | Всего транзакций |
| canton.ledger.lag | Задержка от Sequencer |

---

## 14. Безопасность

### Уровни безопасности

```
+------------------------------------------------------------+
| Level 5: Network Security                                   |
|  - TLS/mTLS -> DevNet: off, TestNet/MainNet: on            |
|  - JWT/JWKS -> Supabase Auth                               |
+------------------------------------------------------------+
| Level 4: Ledger Security                                    |
|  - Canton privacy model                                     |
|  - Sub-transaction privacy                                 |
+------------------------------------------------------------+
| Level 3: SDK Security                                       |
|  - act_as/read_as права -> минимальные                     |
|  - Secrets -> env/secret manager                           |
+------------------------------------------------------------+
```

---

## 15. Тестирование

### Health check DevNet

```bash
# HTTP API
curl -s http://65.108.15.30:30757/health

# gRPC services
grpcurl -plaintext 65.108.15.30:30501 list

# Check participant
curl http://65.108.15.30:30757/api/v1/ledger/identity
```

### Unit test example

```rust
#[cfg(test)]
mod tests {
    use canton_ledger_api::LedgerClient;
    
    #[tokio::test]
    async fn test_submit_command() {
        let client = LedgerClient::connect(
            "http://65.108.15.30:30501",
            "participant1"
        ).await.unwrap();
        
        assert!(client.ledger_id().len() > 0);
    }
}
```

---

## 16. Быстрый старт

```bash
# 1. Настроить окружение
cp .secrets.example .env
# Заполнить CANTON_* переменные

# 2. Собрать SDK
cargo build --release -p canton-ledger-api

# 3. Запустить тесты
cargo test --package canton-ledger-api --test integration

# 4. Деплой
docker build -t canton-otc:latest .
kubectl apply -f k8s/canton-otc/
```

---

## 17. Связанные документы

| Документ | Назначение |
|----------|------------|
| blockchain/DEFI_CONNECT_DEVNET.md | Подключение DeFi к DevNet |
| docs/PRD_CANTON_DEFI_2026/CANTON_DEVNET_FULL_INTEGRATION_PLAN.md | План интеграции |
| docs/PRD_CANTON_DEFI_2026/05_DAML_CONTRACTS_SPEC.md | Спецификация DAML контрактов |
| blockchain/CANTON_NETWORKS_COMPLETE_REPORT.md | Все сети Canton |

---

## 18. Полезные ссылки

- **Canton Docs**: https://docs.canton.io/
- **Splice DevNet**: https://docs.dev.sync.global/
- **Validator Onboarding**: https://docs.dev.sync.global/validator_operator/validator_onboarding.html
- **Slack**: #canton-sdk, #validator-operations

---

**Следующие шаги:**

1. Нода подключена к DevNet
2. SDK крейты в разработке
3. Интеграция с DeFi модулями
4. Тестирование E2E
