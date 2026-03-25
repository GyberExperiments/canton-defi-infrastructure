# 🎯 КРИТИЧЕСКИЙ ПРОМПТ: Интеграция Canton Rust SDK с OTC Platform

## 🔴 ТЕКУЩАЯ ПРОБЛЕМА

**ОБНАРУЖЕНО**: Canton OTC Platform НЕ использует реальный Canton Network SDK!

### Что работает НЕ ТАК:
1. ❌ **Rust SDK** (`cantonnet-omnichain-sdk`) существует но НЕ подключен к Next.js
2. ❌ **@daml JavaScript SDK** объявлен в package.json но НЕ установлен в production
3. ❌ **DamlIntegrationService** использует MOCK ledger (fallback mode)
4. ❌ **API `/api/create-order`** создает только записи в БД, БЕЗ DAML смарт-контрактов
5. ❌ Тестовый заказ `MLP2FMH7-PZG6E7` создан только в Google Sheets, НЕ на Canton Ledger

### Что работает ПРАВИЛЬНО:
- ✅ Canton Validator Node развернут: `65.108.15.30:30501` (gRPC), `:30757` (HTTP JSON API)
- ✅ Participant pod работает: `participant-5c8bc8496b-hnspj` в namespace `validator`
- ✅ Canton OTC app развернут: 2 pods в namespace `canton-otc`
- ✅ ConfigMap настроен с DAML connection variables
- ✅ Rust SDK готов в `cantonnet-omnichain-sdk/`

---

## 🎯 ЗАДАЧА: Интегрировать Rust SDK для РЕАЛЬНЫХ DAML контрактов

### Архитектура Rust SDK
```
cantonnet-omnichain-sdk/
├── crates/
│   ├── canton-core/          # Типы, ошибки, трейты
│   ├── canton-ledger-api/    # gRPC Ledger API v2 клиент
│   ├── canton-crypto/        # KeyStore, подписи
│   ├── canton-wallet/        # Wallet, PartyId
│   └── canton-transport/     # gRPC transport (tonic)
├── Cargo.toml                # Workspace config
└── config/
    ├── example.yaml          # DevNet config
    └── local.yaml            # Production config (gitignored)
```

**Canton DevNet Participant** (уже развернут):
- gRPC: `65.108.15.30:30501`
- HTTP JSON API: `http://65.108.15.30:30757`
- Internal K8s: `participant.validator.svc.cluster.local:5001`

---

## 📋 ПЛАН ИНТЕГРАЦИИ

### Вариант 1: REST API Wrapper для Rust SDK (РЕКОМЕНДУЕТСЯ)

Создать отдельный микросервис на Rust который:
1. Использует `canton-ledger-api` для подключения к Canton participant
2. Предоставляет REST API для Next.js приложения
3. Управляет DAML контрактами (create, exercise, query)

**Преимущества**:
- ✅ Полный контроль над Canton SDK
- ✅ Нативная производительность Rust
- ✅ Простая интеграция через HTTP
- ✅ Легко деплоить в K8s

**Файлы для создания**:
```
cantonnet-omnichain-sdk/
└── crates/
    └── canton-api-server/    # Новый крейт
        ├── src/
        │   ├── main.rs       # Actix-web или Axum server
        │   ├── handlers/     # REST endpoints
        │   │   ├── orders.rs
        │   │   ├── contracts.rs
        │   │   └── settlements.rs
        │   └── canton/       # Canton Ledger integration
        │       ├── client.rs
        │       └── contracts.rs
        └── Cargo.toml
```

**REST API Endpoints**:
```
POST   /api/v1/contracts/offer          # Create OtcOffer contract
POST   /api/v1/contracts/escrow         # Create Escrow contract
POST   /api/v1/contracts/settlement     # Create Settlement contract
POST   /api/v1/contracts/exercise       # Exercise choice on contract
GET    /api/v1/contracts/{id}           # Query contract by ID
GET    /api/v1/contracts/query          # Query contracts by template
GET    /api/v1/health                   # Health check
```

### Вариант 2: WebAssembly (WASM) модуль

Компилировать Rust SDK в WASM для использования в Next.js напрямую.

**Минусы**:
- ⚠️ gRPC в WASM сложен (нужен polyfill)
- ⚠️ Ограничения браузерной среды
- ⚠️ Сложная отладка

**НЕ РЕКОМЕНДУЕТСЯ** для Canton Ledger API (gRPC).

### Вариант 3: Node.js Native Module (napi-rs)

Создать Node.js addon через napi-rs.

**Минусы**:
- ⚠️ Сложная сборка и deployment
- ⚠️ Привязка к платформе (x86_64/arm64)

---

## ✅ РЕКОМЕНДУЕМОЕ РЕШЕНИЕ: REST API Server

### Шаг 1: Создать Canton API Server (Rust)

**Файл**: `cantonnet-omnichain-sdk/crates/canton-api-server/src/main.rs`

```rust
use actix_web::{web, App, HttpServer, HttpResponse};
use canton_ledger_api::LedgerClient;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    participant: String,
    connected: bool,
}

#[derive(Deserialize)]
struct CreateOfferRequest {
    order_id: String,
    initiator: String,
    counterparty: Option<String>,
    asset: String,
    quantity: f64,
    price: f64,
    offer_type: String, // "buy" or "sell"
}

#[derive(Serialize)]
struct CreateOfferResponse {
    contract_id: String,
    transaction_id: String,
}

async fn health(ledger: web::Data<LedgerClient>) -> HttpResponse {
    // Check Canton connection
    let connected = ledger.is_connected().await;
    HttpResponse::Ok().json(HealthResponse {
        status: "healthy".to_string(),
        participant: "participant.validator.svc.cluster.local:5001".to_string(),
        connected,
    })
}

async fn create_offer(
    req: web::Json<CreateOfferRequest>,
    ledger: web::Data<LedgerClient>,
) -> HttpResponse {
    // Create OtcOffer DAML contract
    let contract_id = ledger
        .create_contract(
            "OtcOffer",
            serde_json::json!({
                "orderId": req.order_id,
                "initiator": req.initiator,
                "counterparty": req.counterparty,
                "asset": req.asset,
                "quantity": req.quantity,
                "price": req.price,
                "offerType": req.offer_type,
            }),
        )
        .await
        .unwrap();

    HttpResponse::Ok().json(CreateOfferResponse {
        contract_id: contract_id.clone(),
        transaction_id: format!("tx_{}", contract_id),
    })
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize Canton Ledger client
    let ledger_client = LedgerClient::new(
        "participant.validator.svc.cluster.local:5001",
        "canton-otc-platform",
    )
    .await
    .expect("Failed to connect to Canton Ledger");

    println!("🏛️ Canton API Server starting...");
    println!("📡 Connected to Canton Ledger: participant.validator.svc.cluster.local:5001");

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(ledger_client.clone()))
            .route("/health", web::get().to(health))
            .route("/api/v1/contracts/offer", web::post().to(create_offer))
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}
```

**Файл**: `cantonnet-omnichain-sdk/crates/canton-api-server/Cargo.toml`

```toml
[package]
name = "canton-api-server"
version = "0.1.0"
edition = "2021"

[dependencies]
actix-web = "4"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
canton-ledger-api = { path = "../canton-ledger-api" }
canton-core = { path = "../canton-core" }
```

### Шаг 2: Создать Kubernetes Deployment для API Server

**Файл**: `config/kubernetes/k8s/canton-api-server-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: canton-api-server
  namespace: canton-otc
spec:
  replicas: 2
  selector:
    matchLabels:
      app: canton-api-server
  template:
    metadata:
      labels:
        app: canton-api-server
    spec:
      containers:
      - name: canton-api-server
        image: ghcr.io/themacroeconomicdao/canton-api-server:latest
        ports:
        - containerPort: 8080
          name: http
        env:
        - name: CANTON_LEDGER_HOST
          value: "participant.validator.svc.cluster.local"
        - name: CANTON_LEDGER_PORT
          value: "5001"
        - name: CANTON_APPLICATION_ID
          value: "canton-otc-platform"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: canton-api-server
  namespace: canton-otc
spec:
  selector:
    app: canton-api-server
  ports:
  - port: 8080
    targetPort: 8080
    name: http
  type: ClusterIP
```

### Шаг 3: Модифицировать Next.js API для использования Rust SDK

**Файл**: `src/app/api/create-order/route.ts`

Добавить после создания заказа в БД:

```typescript
// ✅ CREATE DAML CONTRACT via Rust Canton SDK
if (process.env.CANTON_API_SERVER_URL) {
  try {
    const cantonApiUrl = process.env.CANTON_API_SERVER_URL || 'http://canton-api-server:8080';
    
    // Create OtcOffer contract on Canton Ledger
    const contractResponse = await fetch(`${cantonApiUrl}/api/v1/contracts/offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: orderId,
        initiator: `party::${orderId}`, // Generate PartyId
        counterparty: null, // Open offer
        asset: 'USDT',
        quantity: order.cantonAmount,
        price: order.usdtAmount / order.cantonAmount,
        offer_type: order.orderType,
      }),
    });

    if (!contractResponse.ok) {
      throw new Error(`Canton API error: ${contractResponse.status}`);
    }

    const contractResult = await contractResponse.json();
    console.log('✅ DAML OtcOffer contract created:', {
      orderId,
      contractId: contractResult.contract_id,
      transactionId: contractResult.transaction_id,
    });

    // Save contract ID to order
    (order as any).damlContractId = contractResult.contract_id;
    (order as any).damlTransactionId = contractResult.transaction_id;
    
  } catch (cantonError) {
    console.error('⚠️ Canton contract creation failed (non-blocking):', {
      orderId,
      error: cantonError instanceof Error ? cantonError.message : String(cantonError),
    });
    // Don't fail the order - Canton is optional for backward compatibility
  }
} else {
  console.warn('⚠️ CANTON_API_SERVER_URL not configured - DAML contracts disabled');
}
```

### Шаг 4: Добавить переменную в ConfigMap

```bash
kubectl patch configmap canton-otc-config -n canton-otc --type merge -p '{
  "data": {
    "CANTON_API_SERVER_URL": "http://canton-api-server:8080"
  }
}'
```

### Шаг 5: Деплой

```bash
# 1. Собрать Rust API server
cd cantonnet-omnichain-sdk
cargo build --release -p canton-api-server

# 2. Создать Docker image
docker build -t ghcr.io/themacroeconomicdao/canton-api-server:latest -f docker/Dockerfile.api-server .
docker push ghcr.io/themacroeconomicdao/canton-api-server:latest

# 3. Задеплоить в K8s
kubectl apply -f config/kubernetes/k8s/canton-api-server-deployment.yaml

# 4. Рестартовать Canton OTC с новой переменной
kubectl rollout restart deployment/canton-otc -n canton-otc
```

---

## 🧪 ТЕСТИРОВАНИЕ

### 1. Проверить Canton API Server

```bash
kubectl exec -n canton-otc deployment/canton-api-server -- curl http://localhost:8080/health
```

Ожидаемый ответ:
```json
{
  "status": "healthy",
  "participant": "participant.validator.svc.cluster.local:5001",
  "connected": true
}
```

### 2. Создать тестовый заказ

```bash
kubectl exec -n canton-otc deployment/canton-otc -- node -e "
const http = require('http');
const postData = JSON.stringify({
  email: 'test@canton.real',
  cantonAddress: '1220abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678',
  orderType: 'buy',
  usdtAmount: 1000,
  cantonAmount: 9900,
  paymentNetwork: 'TRC20',
  paymentAmountUSD: 1000,
  manualPrice: 0.1,
  isMarketPrice: false
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/create-order',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('Order ID:', json.orderId);
    console.log('DAML Contract ID:', json.damlContractId);
    console.log('DAML Transaction ID:', json.damlTransactionId);
  });
});
req.write(postData);
req.end();
"
```

### 3. Проверить логи Canton API Server

```bash
kubectl logs -n canton-otc deployment/canton-api-server --tail=50
```

Должно быть:
```
✅ DAML OtcOffer contract created: { contract_id: "...", transaction_id: "..." }
```

### 4. Query Canton Ledger напрямую

```bash
# Через Canton API Server
curl http://65.108.15.30:30757/v1/query \
  -H "Content-Type: application/json" \
  -d '{
    "templateIds": ["OtcOffer"],
    "query": {}
  }'
```

---

## ✅ КРИТЕРИИ УСПЕХА

1. ✅ Canton API Server развернут и отвечает на `/health`
2. ✅ `connected: true` в health check
3. ✅ Создание заказа возвращает `damlContractId` и `damlTransactionId`
4. ✅ Логи показывают "DAML OtcOffer contract created"
5. ✅ Query Canton Ledger возвращает созданные контракты
6. ✅ НЕТ использования mock ledger

---

## 📝 КОМАНДЫ ДЛЯ КОПИРОВАНИЯ

```bash
# Клонировать репо и перейти в SDK
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/cantonnet-omnichain-sdk

# Создать canton-api-server крейт
cargo new --lib crates/canton-api-server

# Добавить в workspace
# Редактировать Cargo.toml в корне, добавить:
# members = [..., "crates/canton-api-server"]

# Создать структуру
mkdir -p crates/canton-api-server/src/handlers
mkdir -p crates/canton-api-server/src/canton

# Скопировать код из промпта выше

# Собрать
cargo build --release -p canton-api-server

# Создать Dockerfile
cat > docker/Dockerfile.api-server << 'EOF'
FROM rust:1.75 as builder
WORKDIR /app
COPY . .
RUN cargo build --release -p canton-api-server

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/canton-api-server /usr/local/bin/
EXPOSE 8080
CMD ["canton-api-server"]
EOF

# Собрать и запушить Docker image
docker build -t ghcr.io/themacroeconomicdao/canton-api-server:latest -f docker/Dockerfile.api-server .
docker push ghcr.io/themacroeconomicdao/canton-api-server:latest

# Деплой в K8s
kubectl apply -f config/kubernetes/k8s/canton-api-server-deployment.yaml

# Добавить переменную в Canton OTC ConfigMap
kubectl patch configmap canton-otc-config -n canton-otc --type merge -p '{"data":{"CANTON_API_SERVER_URL":"http://canton-api-server:8080"}}'

# Рестартовать Canton OTC
kubectl rollout restart deployment/canton-otc -n canton-otc

# Проверить
kubectl get pods -n canton-otc
kubectl logs -n canton-otc deployment/canton-api-server --tail=50
```

---

## 🎯 ИТОГОВАЯ ЦЕЛЬ

**После выполнения этого промпта**:

1. ✅ Canton Rust SDK (`canton-ledger-api`) подключен к Canton participant
2. ✅ Canton API Server (Rust) работает в K8s и создает РЕАЛЬНЫЕ DAML контракты
3. ✅ Next.js API `/create-order` вызывает Canton API Server
4. ✅ Каждый новый заказ создает OtcOffer контракт на Canton Ledger
5. ✅ Можно query контракты через Canton Ledger API
6. ✅ НЕТ моков, НЕТ заглушек - только реальная интеграция

**СТАТУС**: Готово к production использованию с РЕАЛЬНЫМИ смарт-контрактами на Canton Network DevNet.

---

## 📚 КОНТЕКСТ ДЛЯ НОВОГО ЧАТА

**Текущий репозиторий**: `/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc`

**Rust SDK**: `cantonnet-omnichain-sdk/` (submodule)

**Canton DevNet Participant** (уже развернут):
- gRPC: `65.108.15.30:30501`
- HTTP: `http://65.108.15.30:30757`
- K8s Internal: `participant.validator.svc.cluster.local:5001`
- Namespace: `validator`
- Pod: `participant-5c8bc8496b-hnspj`

**Canton OTC App**:
- Namespace: `canton-otc`
- Deployment: `canton-otc`
- Image: `ghcr.io/themacroeconomicdao/cantonotc:main-7d54a5d`
- ConfigMap: `canton-otc-config`

**Git ветки**:
- `main` - production (текущий deploy)
- `ai/agent-artem-p5` - dev fixes
- `hotfix/supabase-optional` - Supabase optional fix (уже merged в main)

**Что УЖЕ СДЕЛАНО**:
- ✅ Исправлены 15 критических багов в Daml контрактах
- ✅ Canton Validator развернут в K8s
- ✅ Canton OTC app развернут в K8s
- ✅ ConfigMap настроен с DAML переменными
- ✅ Supabase сделан опциональным
- ✅ Тестовый заказ создан (БЕЗ DAML контракта)

**Что НУЖНО СДЕЛАТЬ** (этот промпт):
- 🎯 Создать Canton API Server (Rust)
- 🎯 Интегрировать с Next.js API
- 🎯 Создавать РЕАЛЬНЫЕ DAML контракты при создании заказов
- 🎯 Тестировать end-to-end flow

**НАЧНИ С**: Создания `canton-api-server` крейта в `cantonnet-omnichain-sdk/crates/`
