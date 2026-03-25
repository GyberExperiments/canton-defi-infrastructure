# CANTON OTC BATTLE TEST - PART 1/5: ОБЗОР И СТРАТЕГИЯ

> Это первый из 5 связанных документов. Выполняй их последовательно.
> PART-1 (этот) -> PART-2 (Rust API) -> PART-3 (TypeScript) -> PART-4 (Sandbox) -> PART-5 (E2E тесты)

## ЦЕЛЬ

Привести Canton OTC платформу в полное боевое состояние и протестировать все компоненты
**БЕЗ подключения к Canton Network DevNet** — используя локальный Canton Sandbox.

Это НЕ моки. Это реальный Canton Ledger с реальными DAML контрактами, реальным gRPC,
реальными транзакциями. Единственное отличие от DevNet — sandbox работает локально.

## ТЕКУЩЕЕ СОСТОЯНИЕ (после мержа ai/agent-artem-p5)

### Что работает:
- DAML контракты (5 файлов) — production-ready, все P0 баги исправлены
- TypeScript frontend — деплоится на 1otc.cc
- K8s инфраструктура — deployment, ingress, secrets

### Что СЛОМАНО и нужно починить:

| # | Компонент | Проблема | Severity | Документ |
|---|-----------|----------|----------|----------|
| 1 | Rust API `handlers.rs` | Proto record НЕ совпадает с DAML шаблоном OtcOffer — отсутствуют 13 из 17 полей | **CRITICAL** | PART-2 |
| 2 | Rust API `handlers.rs` | Accept/Cancel choices — неправильные имена и аргументы | **CRITICAL** | PART-2 |
| 3 | Rust API `models.rs` | `f64` вместо `String` для финансовых сумм | **HIGH** | PART-2 |
| 4 | Rust API `handlers.rs` | In-memory storage — данные теряются при рестарте | **MEDIUM** | PART-2 |
| 5 | TS `daml/health/route.ts` | Импортирует несуществующий `damlService` singleton | **HIGH** | PART-3 |
| 6 | TS `damlIntegrationService.ts` | Нет метода `getStatus()` для health endpoint | **HIGH** | PART-3 |
| 7 | `daml.yaml` | `source: src` но контракты лежат в `canton/daml/` | **CRITICAL** | PART-4 |
| 8 | `docker-compose.local-test.yml` | Не протестирован, возможно неверные образы | **HIGH** | PART-4 |
| 9 | `sandbox.conf` | Нет привязки к DAML контрактам | **MEDIUM** | PART-4 |

## АРХИТЕКТУРА (как должно работать)

```
┌──────────────────────────────────────────────────────────────┐
│                    CANTON OTC PLATFORM                       │
│                                                              │
│  ┌─────────────┐     ┌───────────────┐    ┌───────────────┐  │
│  │  Next.js    │───> │  API Routes   │───>│  Supabase     │  │
│  │  Frontend   │     │  (Server)     │    │  (PostgreSQL) │  │
│  │  React 19   │     │               │    └───────────────┘  │
│  └─────────────┘     │  POST /api/   │                       │
│                      │  create-order │   ┌────────────────┐  │
│                      │               │──>│  Rust Canton   │  │
│                      └───────────────┘   │  API Server    │  │
│                                          │  (Axum + gRPC) │  │
│                                          │  :8080         │  │
│                                          └──────┬─────────┘  │
│                                                 │ gRPC       │
│                                                 │ Ledger     │
│                                                 │ API v2     │
│                                         ┌───────▼────────┐   │
│                                         │  Canton        │   │
│                                         │  Participant   │   │
│                                         │  :5011         │   │
│                                         └───────┬────────┘   │
│                                                 │            │
│                                         ┌───────▼────────┐   │
│                                         │  DAML Smart    │   │
│                                         │  Contracts     │   │
│                                         │  (5 шаблонов)  │   │
│                                         └────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## DAML КОНТРАКТЫ (справка)

### OtcTypes.daml — типы данных
```
OtcSide        = Buy | Sell
OtcStatus      = Pending | Active | PartiallyFilled | Filled | Cancelled | Expired | Disputed | Rejected
Asset          = { symbol: Text, amount: Decimal, chain: Text, contractAddress: Optional Text }
Price          = { rate: Decimal, currency: Text }
VolumeLimits   = { minAmount: Decimal, maxAmount: Decimal }
Timestamps     = { created: Time, updated: Time, expiresAt: Optional Time }
SettlementInfo = { settlementId: Text, paymentProof: Text, confirmations: Int, completedAt: Optional Time }
CollateralStatus = CollateralAvailable | CollateralLocked | CollateralReleased | CollateralForfeited | CollateralLiquidated
CollateralInfo = { collateralId: Text, asset: Asset, lockedUntil: Time, status: CollateralStatus }
AcceptResult   = { tradeId: Text, actualQuantity: Decimal, actualPrice: Decimal, settlementTime: Time, settlementId: Text, slippageBps: Int }
```

### OtcOffer.daml — главный контракт
```
Template OtcOffer:
  Fields: offerId, operator, initiator, counterparty(Optional), asset(Asset),
          price(Price), quantity(Decimal), side(OtcSide), limits(VolumeLimits),
          status(OtcStatus), timestamps(Timestamps), collateral(Optional CollateralInfo),
          settlementInfo(Optional SettlementInfo), minComplianceLevel(Text),
          allowedJurisdictions([Text]), auditors([Party])

  Key: (operator, offerId)
  Signatories: initiator, operator
  Observers: counterparty + auditors

  Choices:
    Accept  { acceptor, requestedQuantity, complianceOk, currentTime, paymentProof } -> AcceptResult
    Cancel  { canceller, reason, currentTime } -> ()
    Expire  { currentTime } -> ()
    Settle  { settler, confirmationCount, currentTime } -> ()
    Dispute { disputer, reason, currentTime } -> ContractId OtcOffer
```

### Другие контракты
- **Collateral.daml** — залоги (Lock, Release, Forfeit, Withdraw, TopUp, AutoRelease)
- **Escrow.daml** — эскроу (Deposit, Release, PartialRelease, Refund, Dispute, Arbitrate, ExecuteArbitration)
- **Settlement.daml** — расчёты (ConfirmPayment, AddConfirmation, CompleteSettlement, DisputeSettlement, ResolveDispute, TimeoutSettlement)

## ФАЙЛОВАЯ СТРУКТУРА (ключевые файлы)

```
canton-otc/
├── canton/daml/                          # DAML контракты
│   ├── OtcTypes.daml                     # Типы данных
│   ├── OtcOffer.daml                     # Главный OTC контракт
│   ├── Collateral.daml                   # Залоги
│   ├── Escrow.daml                       # Эскроу
│   └── Settlement.daml                   # Расчёты
│
├── daml/daml.yaml                        # DAML project config (НУЖНО ПОЧИНИТЬ source path)
│
├── cantonnet-omnichain-sdk/crates/
│   ├── canton-otc-api/src/               # Rust REST API (НУЖНО ПОЧИНИТЬ)
│   │   ├── main.rs                       # Entry point, Axum server
│   │   ├── routes.rs                     # GET/POST routes
│   │   ├── handlers.rs                   # !!! КРИТИЧЕСКИЕ БАГИ — proto mapping
│   │   ├── models.rs                     # OtcContract, ContractStatus
│   │   ├── config.rs                     # AppConfig from env
│   │   ├── state.rs                      # AppState + CommandServiceClient
│   │   ├── error.rs                      # ApiError types
│   │   └── reconnect.rs                  # Background reconnection
│   └── canton-ledger-api/src/
│       ├── client.rs                     # LedgerClient (gRPC + auth)
│       └── lib.rs                        # Proto compiled / stub mode
│
├── src/                                  # Next.js TypeScript
│   ├── app/api/
│   │   ├── create-order/route.ts         # OTC order -> Rust API -> DAML
│   │   └── daml/health/route.ts          # !!! СЛОМАН — несуществующий импорт
│   └── lib/canton/
│       ├── config/cantonEnv.ts           # Centralized Canton config
│       └── services/
│           └── damlIntegrationService.ts # !!! Нет getStatus() + нет singleton export
│
├── docker-compose.local-test.yml         # Локальный sandbox (НУЖНО ПОЧИНИТЬ)
├── local-test/
│   ├── canton-config/sandbox.conf        # Canton sandbox config
│   └── scripts/build-and-deploy.sh       # Build DAR + upload + allocate parties
│
└── config/kubernetes/k8s/
    └── canton-api-server-rust.yaml       # K8s deployment для Rust API
```

## ПОРЯДОК ВЫПОЛНЕНИЯ

1. **PART-2** `BATTLE_TEST_PART2_RUST_API_FIX.md` — Починить Rust API Server
   - Переписать `handlers.rs` — proto mapping для всех 17 полей OtcOffer
   - Исправить Exercise commands (Accept, Cancel) — правильные имена и аргументы
   - Добавить вложенные proto Record для Asset, Price, VolumeLimits, etc.
   - Заменить `f64` на `String` в моделях

2. **PART-3** `BATTLE_TEST_PART3_TYPESCRIPT_FIX.md` — Починить TypeScript
   - Починить `/api/daml/health/route.ts` — создать singleton + getStatus()
   - Убедиться что `create-order/route.ts` правильно вызывает Rust API

3. **PART-4** `BATTLE_TEST_PART4_LOCAL_SANDBOX.md` — Развернуть локальный sandbox
   - Починить `daml.yaml` (source path)
   - Починить `docker-compose.local-test.yml`
   - Развернуть Canton Sandbox + загрузить DAR + allocate parties
   - Проверить что Rust API подключается к sandbox

4. **PART-5** `BATTLE_TEST_PART5_E2E_TESTING.md` — Боевое тестирование
   - Создать OtcOffer через API и проверить на ledger
   - Accept, Cancel, Dispute flows
   - Collateral + Escrow + Settlement полный цикл
   - Нагрузочное тестирование
   - Проверка ошибок и edge cases

## ВАЖНЫЕ ПРАВИЛА

1. **НЕ ИСПОЛЬЗУЙ МОКИ** — всё через реальный Canton Sandbox
2. **НЕ УПРОЩАЙ** — все 17 полей OtcOffer должны передаваться через proto
3. **НЕ СОЗДАВАЙ ЗАГЛУШКИ** — если что-то не работает, чини по-настоящему
4. **ПРОВЕРЯЙ РЕЗУЛЬТАТ** — после каждого шага запускай тесты
5. **СОХРАНЯЙ СОВМЕСТИМОСТЬ** — не ломай существующий API contract для frontend
