# CANTON OTC BATTLE TEST - PART 2/5: ФИКС RUST API SERVER

> Предыдущий: PART-1 (BATTLE_TEST_PART1_OVERVIEW.md)
> Следующий: PART-3 (BATTLE_TEST_PART3_TYPESCRIPT_FIX.md)

## ЗАДАЧА

Полностью переписать proto mapping в Rust Canton API Server чтобы он создавал
DAML контракты OtcOffer с ПРАВИЛЬНОЙ структурой — все 17 полей, вложенные типы,
правильные имена choices.

## ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ

```
cantonnet-omnichain-sdk/crates/canton-otc-api/src/
├── handlers.rs   # ПОЛНАЯ ПЕРЕРАБОТКА — proto mapping
├── models.rs     # ПЕРЕРАБОТКА — добавить все поля + String вместо f64
├── config.rs     # Без изменений
├── state.rs      # Без изменений
├── routes.rs     # Добавить новые endpoints
├── error.rs      # Без изменений
├── main.rs       # Без изменений
└── reconnect.rs  # Без изменений
```

---

## ШАГ 1: Переписать models.rs

### ТЕКУЩИЙ КОД (СЛОМАН):
```rust
// models.rs — ТЕКУЩИЙ
pub struct OtcContract {
    pub contract_id: String,
    pub transaction_id: String,
    pub order_id: String,
    pub initiator: String,
    pub asset: String,         // Просто строка! А нужен Asset { symbol, amount, chain, contractAddress }
    pub quantity: f64,          // f64! Потеря точности на финансовых суммах!
    pub price: f64,             // f64!
    pub offer_type: String,
    pub status: ContractStatus,
    pub created_at: DateTime<Utc>,
}

pub enum ContractStatus {
    Active,
    Accepted,
    Cancelled,
}
```

### НОВЫЙ КОД (ИСПРАВЛЕННЫЙ):
```rust
// models.rs — НОВЫЙ
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

// === DAML-совместимые типы ===

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub symbol: String,
    pub amount: String,  // Decimal как строка — без потери точности
    pub chain: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contract_address: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Price {
    pub rate: String,  // Decimal как строка
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeLimits {
    pub min_amount: String,  // Decimal как строка
    pub max_amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Timestamps {
    pub created: String,    // ISO timestamp или microseconds
    pub updated: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OtcSide {
    Buy,
    Sell,
}

impl OtcSide {
    pub fn to_daml_constructor(&self) -> &str {
        match self {
            OtcSide::Buy => "Buy",
            OtcSide::Sell => "Sell",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OtcStatus {
    Pending,
    Active,
    PartiallyFilled,
    Filled,
    Cancelled,
    Expired,
    Disputed,
    Rejected,
}

impl OtcStatus {
    pub fn to_daml_constructor(&self) -> &str {
        match self {
            OtcStatus::Pending => "Pending",
            OtcStatus::Active => "Active",
            OtcStatus::PartiallyFilled => "PartiallyFilled",
            OtcStatus::Filled => "Filled",
            OtcStatus::Cancelled => "Cancelled",
            OtcStatus::Expired => "Expired",
            OtcStatus::Disputed => "Disputed",
            OtcStatus::Rejected => "Rejected",
        }
    }
}

// === API модели ===

#[derive(Debug, Clone, Serialize)]
pub struct OtcContract {
    pub contract_id: String,
    pub transaction_id: String,
    pub offer_id: String,
    pub operator: String,
    pub initiator: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub counterparty: Option<String>,
    pub asset: Asset,
    pub price: Price,
    pub quantity: String,
    pub side: OtcSide,
    pub limits: VolumeLimits,
    pub status: OtcStatus,
    pub min_compliance_level: String,
    pub allowed_jurisdictions: Vec<String>,
    pub created_at: DateTime<Utc>,
}

pub type ContractStore = Arc<RwLock<HashMap<String, OtcContract>>>;

pub fn new_contract_store() -> ContractStore {
    Arc::new(RwLock::new(HashMap::new()))
}
```

---

## ШАГ 2: Переписать handlers.rs — Create Offer

### ПРОБЛЕМА:
Текущий `build_create_offer_commands` передаёт ПЛОСКИЙ record с 7 полями:
```
orderId, initiator, asset(Text!), quantity, price, offerType, createdAt
```

Но DAML OtcOffer требует 17 полей с ВЛОЖЕННЫМИ record-типами:
```
offerId, operator(Party), initiator(Party), counterparty(Optional Party),
asset(Record{symbol,amount,chain,contractAddress}), price(Record{rate,currency}),
quantity(Numeric), side(Variant Buy|Sell), limits(Record{minAmount,maxAmount}),
status(Variant Active), timestamps(Record{created,updated,expiresAt}),
collateral(Optional), settlementInfo(Optional), minComplianceLevel(Text),
allowedJurisdictions(List), auditors(List)
```

### НОВЫЙ CreateOfferRequest:
```rust
#[derive(Deserialize)]
pub struct CreateOfferRequest {
    pub offer_id: String,
    pub initiator: String,                      // Party ID
    #[serde(default)]
    pub counterparty: Option<String>,           // Optional Party ID
    pub asset: AssetRequest,
    pub price: PriceRequest,
    pub quantity: String,                       // Decimal as string
    pub side: String,                           // "buy" or "sell"
    pub limits: VolumeLimitsRequest,
    #[serde(default = "default_compliance")]
    pub min_compliance_level: String,
    #[serde(default)]
    pub allowed_jurisdictions: Vec<String>,
    #[serde(default)]
    pub expires_at: Option<String>,             // ISO 8601 timestamp
}

#[derive(Deserialize)]
pub struct AssetRequest {
    pub symbol: String,
    pub amount: String,                         // Decimal as string
    pub chain: String,
    #[serde(default)]
    pub contract_address: Option<String>,
}

#[derive(Deserialize)]
pub struct PriceRequest {
    pub rate: String,                           // Decimal as string
    pub currency: String,
}

#[derive(Deserialize)]
pub struct VolumeLimitsRequest {
    pub min_amount: String,
    pub max_amount: String,
}

fn default_compliance() -> String { "basic".into() }
```

### НОВЫЙ build_create_offer_commands:
```rust
fn build_create_offer_commands(config: &AppConfig, req: &CreateOfferRequest) -> proto::Commands {
    let template_id = proto::Identifier {
        package_id: config.otc_package_id.clone(),
        module_name: "OtcOffer".into(),       // <-- Модуль, НЕ "OTC"!
        entity_name: "OtcOffer".into(),
    };

    let now_micros = Utc::now().timestamp_micros();

    // === Вложенные record типы ===

    // Asset record
    let asset_record = proto::Value {
        sum: Some(proto::value::Sum::Record(proto::Record {
            record_id: None,
            fields: vec![
                proto_field("symbol", proto_text(&req.asset.symbol)),
                proto_field("amount", proto_numeric_str(&req.asset.amount)),
                proto_field("chain", proto_text(&req.asset.chain)),
                proto_field("contractAddress", proto_optional_text(&req.asset.contract_address)),
            ],
        })),
    };

    // Price record
    let price_record = proto::Value {
        sum: Some(proto::value::Sum::Record(proto::Record {
            record_id: None,
            fields: vec![
                proto_field("rate", proto_numeric_str(&req.price.rate)),
                proto_field("currency", proto_text(&req.price.currency)),
            ],
        })),
    };

    // VolumeLimits record
    let limits_record = proto::Value {
        sum: Some(proto::value::Sum::Record(proto::Record {
            record_id: None,
            fields: vec![
                proto_field("minAmount", proto_numeric_str(&req.limits.min_amount)),
                proto_field("maxAmount", proto_numeric_str(&req.limits.max_amount)),
            ],
        })),
    };

    // Timestamps record
    let expires_at_value = match &req.expires_at {
        Some(ts) => proto_optional_timestamp(Some(ts)),
        None => proto_optional_none(),
    };

    let timestamps_record = proto::Value {
        sum: Some(proto::value::Sum::Record(proto::Record {
            record_id: None,
            fields: vec![
                proto_field("created", Some(proto::Value {
                    sum: Some(proto::value::Sum::Timestamp(now_micros)),
                })),
                proto_field("updated", Some(proto::Value {
                    sum: Some(proto::value::Sum::Timestamp(now_micros)),
                })),
                proto_field("expiresAt", expires_at_value),
            ],
        })),
    };

    // OtcSide variant (Buy or Sell)
    let side_variant = proto_variant(
        if req.side.to_lowercase() == "buy" { "Buy" } else { "Sell" },
        Some(proto::Value { sum: Some(proto::value::Sum::Unit(())) }),
    );

    // OtcStatus variant — новые offers начинают как Active
    let status_variant = proto_variant(
        "Active",
        Some(proto::Value { sum: Some(proto::value::Sum::Unit(())) }),
    );

    // Optional counterparty
    let counterparty_value = match &req.counterparty {
        Some(cp) => proto_optional_party(Some(cp)),
        None => proto_optional_none(),
    };

    // === Главный record с ВСЕМИ 17 полями ===
    let record = proto::Record {
        record_id: Some(template_id.clone()),
        fields: vec![
            proto_field("offerId", proto_text(&req.offer_id)),
            proto_field("operator", proto_party(&config.party_id)),
            proto_field("initiator", proto_party(&req.initiator)),
            proto_field("counterparty", counterparty_value),
            proto_field("asset", Some(asset_record)),
            proto_field("price", Some(price_record)),
            proto_field("quantity", proto_numeric_str(&req.quantity)),
            proto_field("side", Some(side_variant)),
            proto_field("limits", Some(limits_record)),
            proto_field("status", Some(status_variant)),
            proto_field("timestamps", Some(timestamps_record)),
            proto_field("collateral", proto_optional_none()),        // None — без залога по умолчанию
            proto_field("settlementInfo", proto_optional_none()),    // None — нет settlement info
            proto_field("minComplianceLevel", proto_text(&req.min_compliance_level)),
            proto_field("allowedJurisdictions", proto_list_text(&req.allowed_jurisdictions)),
            proto_field("auditors", proto_list_party(&[])),          // Пустой список auditors
        ],
    };

    let create_cmd = proto::Command {
        command: Some(proto::command::Command::Create(proto::CreateCommand {
            template_id: Some(template_id),
            create_arguments: Some(record),
        })),
    };

    proto::Commands {
        workflow_id: format!("otc-{}", req.offer_id),
        user_id: config.application_id.clone(),
        command_id: Uuid::new_v4().to_string(),
        act_as: vec![config.party_id.clone()],
        read_as: vec![],
        commands: vec![create_cmd],
        ..Default::default()
    }
}
```

---

## ШАГ 3: Новые proto helper функции

Текущие helpers не поддерживают вложенные типы. Добавить:

```rust
// === Proto value helpers ===

fn proto_text(s: &str) -> Option<proto::Value> {
    Some(proto::Value { sum: Some(proto::value::Sum::Text(s.into())) })
}

fn proto_party(s: &str) -> Option<proto::Value> {
    Some(proto::Value { sum: Some(proto::value::Sum::Party(s.into())) })
}

fn proto_numeric_str(s: &str) -> Option<proto::Value> {
    // Decimal передаётся как строка — без потери точности
    Some(proto::Value { sum: Some(proto::value::Sum::Numeric(s.into())) })
}

fn proto_timestamp_micros(micros: i64) -> Option<proto::Value> {
    Some(proto::Value { sum: Some(proto::value::Sum::Timestamp(micros)) })
}

fn proto_bool(b: bool) -> Option<proto::Value> {
    Some(proto::Value { sum: Some(proto::value::Sum::Bool(b)) })
}

fn proto_int64(v: i64) -> Option<proto::Value> {
    Some(proto::Value { sum: Some(proto::value::Sum::Int64(v)) })
}

fn proto_field(label: &str, value: Option<proto::Value>) -> proto::RecordField {
    proto::RecordField { label: label.into(), value }
}

// DAML Variant (для enum типов: OtcSide, OtcStatus, CollateralStatus)
fn proto_variant(constructor: &str, value: Option<proto::Value>) -> proto::Value {
    proto::Value {
        sum: Some(proto::value::Sum::Variant(Box::new(proto::Variant {
            variant_id: None,
            constructor: constructor.into(),
            value: value.map(Box::new),
        }))),
    }
}

// DAML Optional None
fn proto_optional_none() -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Optional(Box::new(proto::Optional {
            value: None,
        }))),
    })
}

// DAML Optional Some(Text)
fn proto_optional_text(val: &Option<String>) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Optional(Box::new(proto::Optional {
            value: val.as_ref().map(|v| Box::new(proto::Value {
                sum: Some(proto::value::Sum::Text(v.clone())),
            })),
        }))),
    })
}

// DAML Optional Some(Party)
fn proto_optional_party(val: Option<&str>) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Optional(Box::new(proto::Optional {
            value: val.map(|v| Box::new(proto::Value {
                sum: Some(proto::value::Sum::Party(v.into())),
            })),
        }))),
    })
}

// DAML Optional Some(Timestamp) from ISO string
fn proto_optional_timestamp(val: Option<&str>) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Optional(Box::new(proto::Optional {
            value: val.and_then(|v| {
                chrono::DateTime::parse_from_rfc3339(v).ok().map(|dt| {
                    Box::new(proto::Value {
                        sum: Some(proto::value::Sum::Timestamp(dt.timestamp_micros())),
                    })
                })
            }),
        }))),
    })
}

// DAML List of Text
fn proto_list_text(items: &[String]) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::List(proto::List {
            elements: items.iter().map(|s| proto::Value {
                sum: Some(proto::value::Sum::Text(s.clone())),
            }).collect(),
        })),
    })
}

// DAML List of Party
fn proto_list_party(items: &[String]) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::List(proto::List {
            elements: items.iter().map(|s| proto::Value {
                sum: Some(proto::value::Sum::Party(s.clone())),
            }).collect(),
        })),
    })
}
```

---

## ШАГ 4: Исправить Exercise Commands (Accept, Cancel)

### ПРОБЛЕМА:
- Accept использует choice name `"AcceptOffer"` — но в DAML это `"Accept"`
- Accept передаёт только Party — но DAML Accept требует 5 аргументов
- Cancel использует `"CancelOffer"` — но в DAML это `"Cancel"`
- Cancel передаёт Unit — но DAML Cancel требует 3 аргумента

### НОВЫЙ AcceptOfferRequest:
```rust
#[derive(Deserialize)]
pub struct AcceptOfferRequest {
    pub contract_id: String,
    pub acceptor: String,
    pub requested_quantity: String,       // Decimal как строка
    #[serde(default = "default_true")]
    pub compliance_ok: bool,
    pub payment_proof: String,
}

fn default_true() -> bool { true }
```

### НОВЫЙ build для Accept:
```rust
fn build_accept_commands(config: &AppConfig, req: &AcceptOfferRequest) -> proto::Commands {
    let template_id = proto::Identifier {
        package_id: config.otc_package_id.clone(),
        module_name: "OtcOffer".into(),
        entity_name: "OtcOffer".into(),
    };

    let now_micros = Utc::now().timestamp_micros();

    // Accept choice argument — Record с 5 полями
    let choice_arg = proto::Value {
        sum: Some(proto::value::Sum::Record(proto::Record {
            record_id: None,
            fields: vec![
                proto_field("acceptor", proto_party(&req.acceptor)),
                proto_field("requestedQuantity", proto_numeric_str(&req.requested_quantity)),
                proto_field("complianceOk", proto_bool(req.compliance_ok)),
                proto_field("currentTime", proto_timestamp_micros(now_micros)),
                proto_field("paymentProof", proto_text(&req.payment_proof)),
            ],
        })),
    };

    let exercise_cmd = proto::Command {
        command: Some(proto::command::Command::Exercise(proto::ExerciseCommand {
            template_id: Some(template_id),
            contract_id: req.contract_id.clone(),
            choice: "Accept".into(),   // <-- ПРАВИЛЬНОЕ ИМЯ (было "AcceptOffer")
            choice_argument: Some(choice_arg),
        })),
    };

    proto::Commands {
        workflow_id: format!("otc-accept-{}", Uuid::new_v4()),
        user_id: config.application_id.clone(),
        command_id: Uuid::new_v4().to_string(),
        act_as: vec![req.acceptor.clone()],  // acceptor действует, не operator
        read_as: vec![config.party_id.clone()],
        commands: vec![exercise_cmd],
        ..Default::default()
    }
}
```

### НОВЫЙ CancelOfferRequest:
```rust
#[derive(Deserialize)]
pub struct CancelOfferRequest {
    pub contract_id: String,
    #[serde(default)]
    pub canceller: Option<String>,  // Если не указан — используем operator
    pub reason: String,
}
```

### НОВЫЙ build для Cancel:
```rust
fn build_cancel_commands(config: &AppConfig, req: &CancelOfferRequest) -> proto::Commands {
    let template_id = proto::Identifier {
        package_id: config.otc_package_id.clone(),
        module_name: "OtcOffer".into(),
        entity_name: "OtcOffer".into(),
    };

    let canceller = req.canceller.as_deref().unwrap_or(&config.party_id);
    let now_micros = Utc::now().timestamp_micros();

    // Cancel choice argument — Record с 3 полями
    let choice_arg = proto::Value {
        sum: Some(proto::value::Sum::Record(proto::Record {
            record_id: None,
            fields: vec![
                proto_field("canceller", proto_party(canceller)),
                proto_field("reason", proto_text(&req.reason)),
                proto_field("currentTime", proto_timestamp_micros(now_micros)),
            ],
        })),
    };

    let exercise_cmd = proto::Command {
        command: Some(proto::command::Command::Exercise(proto::ExerciseCommand {
            template_id: Some(template_id),
            contract_id: req.contract_id.clone(),
            choice: "Cancel".into(),   // <-- ПРАВИЛЬНОЕ ИМЯ (было "CancelOffer")
            choice_argument: Some(choice_arg),
        })),
    };

    proto::Commands {
        workflow_id: format!("otc-cancel-{}", Uuid::new_v4()),
        user_id: config.application_id.clone(),
        command_id: Uuid::new_v4().to_string(),
        act_as: vec![canceller.to_string()],
        read_as: vec![],
        commands: vec![exercise_cmd],
        ..Default::default()
    }
}
```

---

## ШАГ 5: Добавить новые endpoints в routes.rs

```rust
// routes.rs — добавить:
.route("/api/v1/contracts/dispute", post(handlers::dispute_offer))
.route("/api/v1/contracts", get(handlers::list_contracts))
```

### DisputeOfferRequest:
```rust
#[derive(Deserialize)]
pub struct DisputeOfferRequest {
    pub contract_id: String,
    pub disputer: String,
    pub reason: String,
}
```

Build аналогично Cancel — choice `"Dispute"`, аргумент Record с 3 полями (disputer, reason, currentTime).

### list_contracts handler:
```rust
pub async fn list_contracts(
    State(state): State<AppState>,
) -> Json<Vec<OtcContract>> {
    let store = state.contracts.read().await;
    Json(store.values().cloned().collect())
}
```

---

## ШАГ 6: Обновить K8s манифест

Файл: `config/kubernetes/k8s/canton-api-server-rust.yaml`

Заменить:
```yaml
- name: OTC_PACKAGE_ID
  value: canton-otc-v1   # <-- HARDCODED! Должен быть из secrets
```

На:
```yaml
- name: OTC_PACKAGE_ID
  valueFrom:
    configMapKeyRef:
      name: canton-otc-config
      key: otc-package-id
      optional: true       # Если нет — используем default из кода
```

---

## ПРОВЕРКА РЕЗУЛЬТАТА

После всех изменений Rust API должен:

1. **POST /api/v1/contracts/offer** — создавать OtcOffer с полными 17 полями
2. **POST /api/v1/contracts/accept** — exercise `Accept` с 5 аргументами
3. **POST /api/v1/contracts/cancel** — exercise `Cancel` с 3 аргументами
4. **POST /api/v1/contracts/dispute** — exercise `Dispute` с 3 аргументами
5. **GET /api/v1/contracts** — список всех контрактов
6. **GET /api/v1/contracts/{id}** — контракт по ID
7. **GET /health** — health check

### Пример правильного запроса:
```bash
curl -X POST http://localhost:8080/api/v1/contracts/offer \
  -H "Content-Type: application/json" \
  -d '{
    "offer_id": "offer-001",
    "initiator": "alice::participant1",
    "counterparty": null,
    "asset": {
      "symbol": "USDC",
      "amount": "10000.00",
      "chain": "Canton",
      "contract_address": null
    },
    "price": {
      "rate": "1.01",
      "currency": "USD"
    },
    "quantity": "10000.00",
    "side": "sell",
    "limits": {
      "min_amount": "100.00",
      "max_amount": "10000.00"
    },
    "min_compliance_level": "basic",
    "allowed_jurisdictions": ["US", "EU", "UK"],
    "expires_at": "2026-03-17T00:00:00Z"
  }'
```

### Пример Accept:
```bash
curl -X POST http://localhost:8080/api/v1/contracts/accept \
  -H "Content-Type: application/json" \
  -d '{
    "contract_id": "00abcdef...",
    "acceptor": "bob::participant1",
    "requested_quantity": "5000.00",
    "compliance_ok": true,
    "payment_proof": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  }'
```

---

## ПЕРЕХОДИ К PART-3 после завершения всех шагов этого документа.
