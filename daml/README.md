# Canton Wealth Platform — DAML контракты (Treasury + Common)

Спека: `docs/PRD_CANTON_DEFI_2026/05_DAML_CONTRACTS_SPEC.md`.

## Структура

- **Common**: `Types.daml`, `Compliance.daml`
- **Treasury**: `TreasuryBillToken.daml`, `TreasuryBillHolding.daml`, `YieldDistribution.daml` (YieldPayment, RedemptionReceipt, RedemptionRequest)

## Требования

- [Daml SDK](https://docs.daml.com/getting-started/installation.html) (например 2.9.x или 2.10.x).

## Сборка

```bash
cd daml
daml build
```

Сборка создаёт `.daml/dist/canton-wealth-platform-1.0.0.dar`.

## Генерация TypeScript/JSON (опционально)

```bash
daml codegen js .daml/dist/canton-wealth-platform-1.0.0.dar -o daml-codegen
```

## Деплой на Canton DevNet

См. **`docs/PRD_CANTON_DEFI_2026/DAML_DEVNET_DEPLOY.md`**: загрузка DAR на participant, party/onboarding, проверка.
