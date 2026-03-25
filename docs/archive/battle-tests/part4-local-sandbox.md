# CANTON OTC BATTLE TEST - PART 4/5: ЛОКАЛЬНЫЙ CANTON SANDBOX

> Предыдущий: PART-3 (BATTLE_TEST_PART3_TYPESCRIPT_FIX.md)
> Следующий: PART-5 (BATTLE_TEST_PART5_E2E_TESTING.md)

## ЗАДАЧА

Развернуть полный локальный Canton Sandbox для тестирования DAML контрактов БЕЗ подключения к DevNet.

Это НЕ мок. Это реальный Canton Ledger с реальными DAML контрактами.

---

## ШАГ 1: Починить daml.yaml

### Файл: `daml/daml.yaml`

### ПРОБЛЕМА:
```yaml
source: src   # <-- Контракты лежат в canton/daml/, а не src/
```

### ИСПРАВЛЕНИЕ:
```yaml
sdk-version: 2.9.0
name: canton-otc
version: 1.0.0
source: ../canton/daml   # <-- ПРАВИЛЬНЫЙ путь
parties:
  - Operator
  - Trader1
  - Trader2
  - Auditor
dependencies:
  - daml-prim
  - daml-stdlib
build-options:
  - --target=2.1
```

**Альтернатива**: Переместить `canton/daml/*.daml` → `daml/src/` и оставить `source: src`

---

## ШАГ 2: Проверить структуру DAML проекта

Должна быть:
```
canton-otc/
├── daml/
│   ├── daml.yaml        # Project config (ИСПРАВЛЕН)
│   └── src/             # Если выбрали альтернативу
│       ├── OtcTypes.daml
│       ├── OtcOffer.daml
│       ├── Collateral.daml
│       ├── Escrow.daml
│       └── Settlement.daml
OR
├── canton/daml/         # Текущее расположение
│   ├── OtcTypes.daml
│   ├── OtcOffer.daml
│   ├── Collateral.daml
│   ├── Escrow.daml
│   └── Settlement.daml
└── daml/
    └── daml.yaml        # source: ../canton/daml
```

**Рекомендация:** Использовать `source: ../canton/daml` — не перемещать файлы.

---

## ШАГ 3: Обновить docker-compose.local-test.yml

### Файл: `docker-compose.local-test.yml`

### Текущие проблемы:
1. Volume mount может быть неправильный
2. Нет явной зависимости на сборку DAR перед запуском API
3. Нет проверки что OTC_PACKAGE_ID передался

### ИСПРАВЛЕННАЯ версия:

```yaml
services:
  # === Canton Sandbox (Ledger) ===
  canton-sandbox:
    image: digitalasset/canton-open-source:2.9.3
    container_name: canton-sandbox
    ports:
      - "5011:5011"  # Ledger API (gRPC)
      - "5012:5012"  # Admin API
      - "5021:5021"  # Domain Public API
      - "5022:5022"  # Domain Admin API
    volumes:
      - ./local-test/canton-config/sandbox.conf:/canton/sandbox.conf:ro
    command: ["daemon", "-c", "/canton/sandbox.conf"]
    healthcheck:
      test: ["CMD", "grpcurl", "-plaintext", "localhost:5011", "grpc.health.v1.Health/Check"]
      interval: 10s
      timeout: 5s
      retries: 30
      start_period: 30s
    networks:
      - canton-local

  # === DAML Builder & Deployer ===
  daml-deploy:
    image: digitalasset/daml-sdk:2.9.0
    container_name: daml-deploy
    depends_on:
      canton-sandbox:
        condition: service_healthy
    volumes:
      - ./daml:/daml-project:ro                    # daml.yaml root
      - ./canton/daml:/daml-contracts:ro           # DAML contracts
      - ./local-test/scripts:/scripts:ro
      - daml-dist:/daml-dist                       # Output DAR + env
    working_dir: /daml-project
    environment:
      LEDGER_HOST: canton-sandbox
      LEDGER_PORT: 5011
      ADMIN_HOST: canton-sandbox
      ADMIN_PORT: 5012
    command: ["/scripts/build-and-deploy.sh"]
    networks:
      - canton-local

  # === Rust Canton OTC API Server ===
  canton-otc-api:
    build:
      context: ./cantonnet-omnichain-sdk
      dockerfile: docker/Dockerfile.api-server
    container_name: canton-otc-api
    depends_on:
      daml-deploy:
        condition: service_completed_successfully
    ports:
      - "8080:8080"
    volumes:
      - daml-dist:/daml-dist:ro
    environment:
      CANTON_LEDGER_HOST: canton-sandbox
      CANTON_LEDGER_PORT: 5011
      CANTON_APPLICATION_ID: canton-otc-platform
      CANTON_PARTY_ID: otc_operator::sandbox
      CANTON_LEDGER_ID: canton-otc
      PORT: 8080
      RUST_LOG: canton_otc_api=debug,canton_ledger_api=info
    # Read OTC_PACKAGE_ID from daml-dist/env.sh
    entrypoint: ["/bin/sh", "-c"]
    command:
      - |
        if [ -f /daml-dist/env.sh ]; then
          . /daml-dist/env.sh
          export OTC_PACKAGE_ID
          echo "Loaded OTC_PACKAGE_ID: $${OTC_PACKAGE_ID}"
        else
          echo "WARNING: /daml-dist/env.sh not found, using default"
          export OTC_PACKAGE_ID="canton-otc-v1"
        fi
        exec /usr/local/bin/canton-otc-api
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s
    networks:
      - canton-local

networks:
  canton-local:
    driver: bridge

volumes:
  daml-dist:
```

---

## ШАГ 4: Обновить build-and-deploy.sh

### Файл: `local-test/scripts/build-and-deploy.sh`

### Добавить проверки и улучшенный вывод:

```bash
#!/bin/bash
set -e

echo "========================================="
echo "DAML Build & Deploy Script"
echo "========================================="

# === 1. Build DAML ===
echo "[1/5] Building DAML contracts..."
cd /daml-project

if [ ! -f "daml.yaml" ]; then
  echo "ERROR: daml.yaml not found in $(pwd)"
  exit 1
fi

daml build -o /daml-dist/canton-otc.dar
echo "✓ DAR built: /daml-dist/canton-otc.dar"

# === 2. Wait for Canton Ledger API ===
echo "[2/5] Waiting for Canton Ledger API..."
LEDGER_URL="http://${LEDGER_HOST}:${LEDGER_PORT}"
ADMIN_URL="http://${ADMIN_HOST}:${ADMIN_PORT}"

for i in {1..60}; do
  if grpcurl -plaintext ${LEDGER_HOST}:${LEDGER_PORT} grpc.health.v1.Health/Check > /dev/null 2>&1; then
    echo "✓ Ledger API is ready"
    break
  fi
  echo "Waiting for Ledger API... ($i/60)"
  sleep 2
done

# === 3. Upload DAR ===
echo "[3/5] Uploading DAR to participant..."
daml ledger upload-dar \
  --host ${LEDGER_HOST} \
  --port ${LEDGER_PORT} \
  /daml-dist/canton-otc.dar

echo "✓ DAR uploaded successfully"

# === 4. Allocate Parties ===
echo "[4/5] Allocating parties..."

# Allocate operator
daml ledger allocate-party \
  --host ${LEDGER_HOST} \
  --port ${LEDGER_PORT} \
  otc_operator

# Allocate traders
daml ledger allocate-party \
  --host ${LEDGER_HOST} \
  --port ${LEDGER_PORT} \
  trader_alice

daml ledger allocate-party \
  --host ${LEDGER_HOST} \
  --port ${LEDGER_PORT} \
  trader_bob

# Allocate auditor
daml ledger allocate-party \
  --host ${LEDGER_HOST} \
  --port ${LEDGER_PORT} \
  auditor

echo "✓ Parties allocated"

# === 5. Extract Package ID ===
echo "[5/5] Extracting package ID..."

PACKAGE_ID=$(daml damlc inspect-dar /daml-dist/canton-otc.dar | grep "package-id:" | awk '{print $2}' | head -1)

if [ -z "$PACKAGE_ID" ]; then
  echo "ERROR: Failed to extract package ID"
  exit 1
fi

echo "export OTC_PACKAGE_ID='${PACKAGE_ID}'" > /daml-dist/env.sh
echo "✓ Package ID: ${PACKAGE_ID}"
echo "✓ Saved to /daml-dist/env.sh"

echo "========================================="
echo "DEPLOYMENT COMPLETE"
echo "========================================="
echo "Ledger Host: ${LEDGER_HOST}:${LEDGER_PORT}"
echo "Package ID: ${PACKAGE_ID}"
echo "Parties:"
echo "  - otc_operator::sandbox"
echo "  - trader_alice::sandbox"
echo "  - trader_bob::sandbox"
echo "  - auditor::sandbox"
echo "========================================="
```

Сделать исполняемым:
```bash
chmod +x local-test/scripts/build-and-deploy.sh
```

---

## ШАГ 5: Запуск и проверка

### Запуск:
```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
docker-compose -f docker-compose.local-test.yml up -d
```

### Мониторинг логов:
```bash
# Все сервисы
docker-compose -f docker-compose.local-test.yml logs -f

# Только DAML deploy
docker-compose -f docker-compose.local-test.yml logs daml-deploy

# Только Rust API
docker-compose -f docker-compose.local-test.yml logs canton-otc-api
```

### Проверка статуса:
```bash
docker-compose -f docker-compose.local-test.yml ps
```

Ожидаемый вывод:
```
NAME               STATUS                     PORTS
canton-sandbox     Up (healthy)               5011-5012,5021-5022->...
daml-deploy        Exited (0)                 -
canton-otc-api     Up (healthy)               8080->8080
```

### Health checks:
```bash
# Canton Sandbox
grpcurl -plaintext localhost:5011 grpc.health.v1.Health/Check

# Rust API
curl http://localhost:8080/health | jq
```

Ожидаемый ответ Rust API:
```json
{
  "status": "healthy",
  "connected": true,
  "participant": "http://canton-sandbox:5011",
  "mode": "daml-ledger-api-v2",
  "ledger_end": "000000000000000a",
  "application_id": "canton-otc-platform",
  "version": "0.1.0",
  "party_id": "otc_operator::sandbox",
  "timestamp": "2026-02-18T..."
}
```

---

## ШАГ 6: Проверка Package ID

```bash
# Проверить что env.sh создан
docker exec canton-otc-api cat /daml-dist/env.sh

# Ожидается:
# export OTC_PACKAGE_ID='abc123def456...'

# Проверить что Rust API его видит
docker exec canton-otc-api env | grep OTC_PACKAGE_ID
```

---

## ШАГ 7: Тестовый запрос к API

```bash
# Создать тестовый OtcOffer
curl -X POST http://localhost:8080/api/v1/contracts/offer \
  -H "Content-Type: application/json" \
  -d '{
    "offer_id": "test-001",
    "initiator": "trader_alice::sandbox",
    "counterparty": null,
    "asset": {
      "symbol": "USDC",
      "amount": "1000.00",
      "chain": "Canton",
      "contract_address": null
    },
    "price": {
      "rate": "1.00",
      "currency": "USD"
    },
    "quantity": "1000.00",
    "side": "sell",
    "limits": {
      "min_amount": "10.00",
      "max_amount": "1000.00"
    },
    "min_compliance_level": "basic",
    "allowed_jurisdictions": ["US", "EU"],
    "expires_at": "2026-03-18T00:00:00Z"
  }' | jq
```

Ожидаемый ответ:
```json
{
  "success": true,
  "contract_id": "00abc123...",
  "transaction_id": "txn-uuid...",
  "order_id": "test-001",
  "created_at": "2026-02-18T..."
}
```

---

## TROUBLESHOOTING

### Проблема 1: daml-deploy exited with code 1
```bash
docker-compose -f docker-compose.local-test.yml logs daml-deploy
```

**Возможные причины:**
- `daml.yaml` с неправильным `source` путём
- DAML контракты содержат ошибки компиляции
- Ledger API не доступен

**Решение:**
```bash
# Проверить daml.yaml
cat daml/daml.yaml

# Проверить DAML файлы локально
cd daml
daml build
```

### Проблема 2: canton-otc-api health check failing
```bash
docker-compose -f docker-compose.local-test.yml logs canton-otc-api
```

**Возможные причины:**
- `OTC_PACKAGE_ID` не передался
- Canton Sandbox недоступен
- Неправильный PARTY_ID

**Решение:**
```bash
# Проверить env.sh
docker exec canton-otc-api cat /daml-dist/env.sh

# Проверить connectivity
docker exec canton-otc-api grpcurl -plaintext canton-sandbox:5011 grpc.health.v1.Health/Check
```

### Проблема 3: grpcurl: command not found
Образ `digitalasset/canton-open-source:2.9.3` может не включать `grpcurl`.

**Решение:** Заменить healthcheck:
```yaml
healthcheck:
  test: ["CMD", "nc", "-z", "localhost", "5011"]
  interval: 10s
```

---

## ОЧИСТКА

```bash
# Остановить все сервисы
docker-compose -f docker-compose.local-test.yml down

# Удалить volumes (сбросить всё)
docker-compose -f docker-compose.local-test.yml down -v

# Пересобрать Rust API (если изменился код)
docker-compose -f docker-compose.local-test.yml up -d --build canton-otc-api
```

---

## ПЕРЕХОДИ К PART-5 после успешного запуска и проверки всех endpoints.
