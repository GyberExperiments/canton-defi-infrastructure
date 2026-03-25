# Подключение DeFi и Rust SDK к нашей ноде DevNet

Нода: **65.108.15.30** (participant в DevNet, Ledger API доступен по NodePort).

---

## Эндпоинты

| Назначение | URL / адрес |
|------------|-------------|
| **HTTP Ledger API (JSON)** | `http://65.108.15.30:30757` |
| **gRPC Ledger API** | `65.108.15.30:30501` |

---

## 1. Rust SDK (cantonnet-omnichain-sdk)

### Конфиг `config/example.yaml` или `config/local.yaml`

```yaml
ledger_api:
  grpc_host: "65.108.15.30"
  grpc_port: 30501
  http_url: "http://65.108.15.30:30757"
  tls: false
```

### Код

```rust
use canton_ledger_api::LedgerClient;

// endpoint = "http://65.108.15.30:30501" (gRPC; Tonic ожидает http/https)
let mut client = LedgerClient::connect("http://65.108.15.30:30501", "participant").await?;
let end = client.get_ledger_end().await?;
// submit, streams и т.д.
```

### Env (опционально, для тестов)

```bash
export CANTON_LEDGER_GRPC=65.108.15.30:30501
export CANTON_LEDGER_HTTP=http://65.108.15.30:30757
```

Подробнее: `cantonnet-omnichain-sdk/docs/DEVNET_PARTICIPANT.md`.

---

## 2. DeFi (canton-otc/defi) — фронт и API

Функционал defi: `useRealCantonNetwork`, treasury/portfolio, treasury/bills, CCPurchaseWidget, real estate, privacy vaults. Всё опирается на participant Ledger API и (при необходимости) auth/party.

### Переменные окружения

В `.env.local` или в окружении деплоя:

```bash
# Хост и порт participant (NodePort = 30757 → JSON API 7575)
NEXT_PUBLIC_CANTON_HOST=65.108.15.30
NEXT_PUBLIC_CANTON_PORT=30757

# Или явно URL (переопределяет host:port)
NEXT_PUBLIC_CANTON_LEDGER_URL=http://65.108.15.30:30757/api/v1
NEXT_PUBLIC_CANTON_WS_URL=ws://65.108.15.30:30757/ws

# Participant для API routes (treasury/portfolio, treasury/bills, treasury/purchases)
CANTON_PARTICIPANT_URL=http://65.108.15.30:30757
CANTON_PARTICIPANT_ID=participant1
CANTON_PARTY_ID=wealth_management_party
CANTON_AUTH_TOKEN=
```

- Фронт (`realCantonIntegration.ts`): читает `NEXT_PUBLIC_CANTON_*`, собирает `ledgerApiUrl` (при отсутствии `NEXT_PUBLIC_CANTON_LEDGER_URL` — из host + port + `/api/v1`) и `ledgerWsUrl` (`/ws`).
- API routes в `app/api/defi/treasury/*` и т.п.: используют `CANTON_PARTICIPANT_URL`, `CANTON_PARTICIPANT_ID`, `CANTON_PARTY_ID`, `CANTON_AUTH_TOKEN`.

### Включение реального API

- Реальные запросы к Canton: `NEXT_PUBLIC_CANTON_ENABLE_REAL_API=true` (или в production уже по умолчанию).
- Мок при недоступности: `NEXT_PUBLIC_CANTON_USE_MOCK_FALLBACK=true` (по умолчанию в dev).

---

## 3. Проверка

```bash
# HTTP (JSON API)
curl -s http://65.108.15.30:30757/health 2>/dev/null || curl -s -o /dev/null -w "%{http_code}" http://65.108.15.30:30757/

# gRPC (требуется grpcurl)
grpcurl -plaintext 65.108.15.30:30501 list
```

---

## 4. Ограничения

- **DevNet, без TLS** — только разработка/тесты, не production-данные.
- **Party/Admin** — для записи в ledger нужны заведённые на participant party и при необходимости auth (JWT); `CANTON_PARTY_ID`/`CANTON_AUTH_TOKEN` задать под вашего оператора/приложение.
- **Onboarding secret** — для validator-app живёт 1 час; обновление: `blockchain/scripts/get-onboarding-secret.sh` + `update-onboarding-secret.sh` или Job из `blockchain/k8s/devnet-refresh-onboarding-secret-job.yaml`.
